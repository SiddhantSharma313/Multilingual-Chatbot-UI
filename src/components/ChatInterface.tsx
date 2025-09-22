import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { default as remarkGfm } from 'remark-gfm';
import { default as rehypeRaw } from 'rehype-raw';
import AIService from '../services/aiService';
import KnowledgeBaseService from '../services/knowledgeBaseService';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

import { Send, Bot, User, Globe, Phone, AlertCircle, Menu, Volume2, VolumeX, Settings } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from './AuthContext';
import { AIConfigDialog, AIConfig } from './AIConfigDialog';
import { toast } from 'sonner';
import { VoiceButton } from './VoiceButton';
import { useIsMobile } from './ui/use-mobile';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  language: string;
}

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
];

const sampleQueries = {
  en: [
    "What are the fee payment deadlines?",
    "How do I apply for scholarships?",
    "When is the next semester starting?",
    "What documents are needed for admission?"
  ],
  hi: [
    "फीस भुगतान की अंतिम तारीख क्या है?",
    "छात्रवृत्ति के लिए कैसे आवेदन करें?",
    "अगला सेमेस्टर कब शुरू होगा?",
    "प्रवेश के लिए कौन से दस्तावेज चाहिए?"
  ]
};

// Default AI configuration
const defaultAIConfig: AIConfig = {
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  googleDocsUrl: import.meta.env.VITE_GOOGLE_DOCS_URL || '',
  isConfigured: true
};

export function ChatInterface() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const getWelcomeMessage = () => {
    const firstName = user?.name.split(' ')[0] || 'there';
    return `Hello ${firstName}! I am your campus assistant. I can help you with queries about fees, scholarships, timetables, and more. Please select your preferred language.`;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: getWelcomeMessage(),
      timestamp: new Date(),
      language: 'en'
    }
  ]);
  
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('ai_config');
    return saved ? JSON.parse(saved) : defaultAIConfig;
  });
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiService, setAiService] = useState<AIService | null>(null);
  const [knowledgeBaseService] = useState(new KnowledgeBaseService());
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isTyping, setIsTyping] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [lastBotResponse, setLastBotResponse] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize AI service when config changes
  useEffect(() => {
    if (aiConfig.isConfigured && aiConfig.apiKey) {
      const service = new AIService(aiConfig.apiKey);
      setAiService(service);
      
      // Load knowledge base
      if (aiConfig.googleDocsUrl) {
        knowledgeBaseService.fetchFromGoogleDocs(aiConfig.googleDocsUrl)
          .then(knowledgeBase => {
            service.setKnowledgeBase(knowledgeBase);
            toast.success('Knowledge base loaded successfully!');
          })
          .catch(error => {
            console.error('Failed to load knowledge base:', error);
            service.setKnowledgeBase(knowledgeBaseService.getKnowledgeBase());
            toast.warning('Using default knowledge base');
          });
      } else {
        service.setKnowledgeBase(knowledgeBaseService.getKnowledgeBase());
      }
    } else {
      setAiService(null);
    }
  }, [aiConfig, knowledgeBaseService]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || currentMessage;
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: content,
      timestamp: new Date(),
      language: selectedLanguage
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    // Simulate bot response
    if (aiService && aiConfig.isConfigured) {
      // Use AI service for response
      try {
        const conversationHistory = messages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content
        }));
        
        const response = await aiService.sendMessage(content, selectedLanguage, conversationHistory);
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: response,
          timestamp: new Date(),
          language: selectedLanguage
        };

        setMessages(prev => [...prev, botMessage]);
        setLastBotResponse(response);
        
        // Auto-speak bot response if enabled
        if (autoSpeakEnabled) {
          setTimeout(() => {
            handleSpeakResponse(response);
          }, 500);
        }
      } catch (error) {
        console.error('AI response error:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: selectedLanguage === 'hi' 
            ? "मुझे खुशी है कि आपने पूछा, लेकिन अभी मुझे कुछ तकनीकी समस्या हो रही है। कृपया कुछ देर बाद पुनः प्रयास करें।"
            : "I apologize, but I'm experiencing some technical difficulties right now. Please try again in a moment.",
          timestamp: new Date(),
          language: selectedLanguage
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } else {
      // Fallback to dummy responses if AI is not configured
      setTimeout(() => {
        const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: selectedLanguage === 'hi' 
          ? "AI सेवा कॉन्फ़िगर नहीं है। कृपया व्यवस्थापक से संपर्क करें।"
          : "AI service is not configured. Please contact the administrator to set up the AI integration.",
        timestamp: new Date(),
        language: selectedLanguage
      };
      setMessages(prev => [...prev, fallbackMessage]);
      }, 1000);
    }
    
    setIsTyping(false);
  };

  const handleQuickQuery = (query: string) => {
    setCurrentMessage(query);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const handleVoiceMessage = (message: string) => {
    handleSendMessage(message);
  };

  const handleSpeakResponse = (text: string) => {
    if (!window.speechSynthesis || !text.trim()) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Language mappings
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'mr': 'mr-IN',
      'te': 'te-IN',
      'ta': 'ta-IN'
    };
    
    utterance.lang = languageMap[selectedLanguage] || 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
  };

  const handleFallbackToHuman = () => {
    const fallbackMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: selectedLanguage === 'hi' 
        ? "मैं आपको हमारे सहायक से जोड़ रहा हूं। कृपया प्रतीक्षा करें या 📞 +91-XXX-XXXX-XXX पर कॉल करें।"
        : "I'm connecting you to our human assistant. Please wait or call 📞 +91-XXX-XXXX-XXX for immediate help.",
      timestamp: new Date(),
      language: selectedLanguage
    };
    
    setMessages(prev => [...prev, fallbackMessage]);
    setShowFallback(false);
  };

  const handleAIConfigSave = (config: AIConfig) => {
    setAiConfig(config);
    localStorage.setItem('ai_config', JSON.stringify(config));
    toast.success('AI configuration saved successfully!');
  };

  const handleOpenAIConfig = () => {
    setShowAIConfig(true);
  };

  // Sidebar content component
  const SidebarContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Quick Queries
            Quick Queries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(sampleQueries[selectedLanguage as keyof typeof sampleQueries] || sampleQueries.en).map((query, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="w-full justify-start text-left h-auto p-2 whitespace-normal"
                onClick={() => handleQuickQuery(query)}
              >
                {query}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* AI Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">AI Status</span>
              <Badge variant={aiConfig.isConfigured ? "default" : "outline"}>
                {aiConfig.isConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
            <Button size="sm" variant="outline" onClick={handleOpenAIConfig} className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configure AI
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Website Widget</span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">WhatsApp</span>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Telegram</span>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">SMS Gateway</span>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
              Account: {user?.role === 'admin' ? 'Administrator' : 'Student'} ({user?.email})
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6 h-full">
      {/* Main Chat Interface */}
      <div className="lg:col-span-3 flex flex-col">
        <Card className="flex-1 flex flex-col h-[calc(100vh-200px)] lg:h-[600px]">
          <CardHeader className="flex-shrink-0 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="hidden sm:inline">Campus Assistant</span>
                <span className="sm:hidden">Assistant</span>
              </CardTitle>
              
              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-24 sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span className="hidden sm:inline">{lang.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Auto-speak Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={autoSpeakEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoSpeakEnabled(!autoSpeakEnabled)}
                        className={autoSpeakEnabled ? "bg-primary text-primary-foreground" : ""}
                      >
                        {autoSpeakEnabled ? (
                          <Volume2 className="h-4 w-4" />
                        ) : (
                          <VolumeX className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {autoSpeakEnabled ? 'Disable auto-speak' : 'Enable auto-speak'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Voice Assistant - Inline Button */}
                <VoiceButton
                  selectedLanguage={selectedLanguage}
                  onVoiceMessage={handleVoiceMessage}
                  onSpeakResponse={handleSpeakResponse}
                  lastBotResponse={lastBotResponse}
                  variant="inline"
                />

                {/* Mobile Menu Button */}
                {isMobile && (
                  <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80">
                      <SheetHeader>
                        <SheetTitle>Quick Actions</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <SidebarContent />
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 pr-2 sm:pr-4">
              <div className="space-y-3 sm:space-y-4 p-1">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-2 sm:gap-3 ${
                      message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {message.type === 'user' ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent flex items-center justify-center">
                          <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {message.type === 'bot' ? (
                        <div className="prose prose-sm w-full max-w-full overflow-x-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              table: ({node, ...props}) => (
                                <table className="min-w-full border border-gray-300 text-sm text-left rounded-lg overflow-x-auto">{props.children}</table>
                              ),
                              th: ({node, ...props}) => (
                                <th className="border px-2 py-1 bg-blue-100 font-bold text-blue-700">{props.children}</th>
                              ),
                              td: ({node, ...props}) => {
                                // Highlight important keywords
                                const highlightKeywords = [
                                  'Specializations', 'Eligibility', 'Fees', 'Duration', 'Program', 'Admission', 'B.Tech', 'ICT', 'CSE', 'CE', 'Mechanical Engineering', 'Civil Engineering', 'Computer Science', 'Information Communication Technology'
                                ];
                                let content = String(props.children);
                                highlightKeywords.forEach(keyword => {
                                  const regex = new RegExp(`(${keyword})`, 'gi');
                                  content = content.replace(regex, '<span style="color:#d97706;font-weight:bold;">$1</span>');
                                });
                                return <td className="border px-2 py-1" dangerouslySetInnerHTML={{__html: content}} />;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base leading-relaxed">{message.content}</p>
                      )}
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 opacity-60">
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {languages.find(l => l.code === message.language)?.flag}
                        </Badge>
                        <span className="text-xs">
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-2 sm:gap-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent flex items-center justify-center">
                      <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-accent-foreground" />
                    </div>
                    <div className="bg-muted rounded-lg px-2 py-1.5 sm:px-3 sm:py-2">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Fallback Alert */}
            {showFallback && (
              <Alert className="mb-3 sm:mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-sm">Need human assistance for this query?</span>
                  <Button size="sm" variant="outline" onClick={handleFallbackToHuman}>
                    <Phone className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Connect to Human</span>
                    <span className="sm:hidden">Connect</span>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Input Area */}
            <div className="flex-shrink-0 border-t pt-3 sm:pt-4">
              <div className="flex gap-1.5 sm:gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder={
                    selectedLanguage === 'hi'
                      ? "अपना प्रश्न यहाँ टाइप करें..."
                      : "Type your question here..."
                  }
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 text-sm sm:text-base"
                />
                
                {/* Voice Input - Compact for mobile */}
                {!isMobile && (
                  <VoiceButton
                    selectedLanguage={selectedLanguage}
                    onVoiceMessage={handleVoiceMessage}
                    onSpeakResponse={handleSpeakResponse}
                    lastBotResponse={lastBotResponse}
                    variant="inline"
                  />
                )}
                
                <Button 
                  onClick={() => handleSendMessage()} 
                  disabled={!currentMessage.trim()}
                  size={isMobile ? "sm" : "default"}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="space-y-6">
          <SidebarContent />
        </div>
      )}
      
      {/* Floating Voice Button - Always visible on both mobile and desktop */}
      <VoiceButton
        selectedLanguage={selectedLanguage}
        onVoiceMessage={handleVoiceMessage}
        onSpeakResponse={handleSpeakResponse}
        lastBotResponse={lastBotResponse}
        variant="floating"
      />
      
      {/* AI Configuration Dialog */}
      <AIConfigDialog
        open={showAIConfig}
        onOpenChange={setShowAIConfig}
        onConfigSave={handleAIConfigSave}
        currentConfig={aiConfig}
      />
    </div>
  );
}