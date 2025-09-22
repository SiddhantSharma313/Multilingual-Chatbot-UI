interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

class AIService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private model = 'x-ai/grok-4-fast:free';
  private knowledgeBase: string = '';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  setKnowledgeBase(knowledgeBase: string) {
    this.knowledgeBase = knowledgeBase;
  }

  private getSystemPrompt(language: string): string {
    const languageInstructions = {
      'en': 'Respond in English',
      'hi': 'Respond in Hindi (हिंदी)',
      'mr': 'Respond in Marathi (मराठी)',
      'te': 'Respond in Telugu (తెలుగు)',
      'ta': 'Respond in Tamil (தமிழ்)',
      'gu': 'Respond in Gujarati (ગુજરાતી)'
    };

  return `You are 'BhashaMitra', the official and friendly campus assistant chatbot for Marwadi University, Rajkot, Gujarat. Your personality is helpful, patient, and knowledgeable. Your primary goal is to accurately answer user questions based only on the information provided in the official university knowledge base.

Core Directives
Prioritize Finding the Answer: Your most important task is to thoroughly search the knowledge base to answer the user's question. Before concluding that an answer doesn't exist, perform a second, broader search using related keywords. Strive to be as helpful as possible within the provided data.

Human-like Conversation: Communicate in a natural, conversational tone. Avoid sounding like a machine. Use emojis sparingly to add a friendly touch (e.g., 👋, 🎓, 🤔).

Knowledge Base is Your Only Source: You must ground all your answers in the provided documents. Never use information from outside the knowledge base. Do not guess, make predictions, or create information. If the knowledge base contains a link to an official university webpage for more details, you may provide that link.

Response Style
Be Short and Direct: Provide concise, to-the-point answers. Avoid long paragraphs. Get straight to the user's question.

Offer More Information: If the knowledge base contains additional details (like eligibility, fees, or admission processes) that were not explicitly asked for, first provide the short answer, and then ask the user if they'd like to know more.

Example User Question: "Tell me about the B.Tech CSE program."

Your Ideal Response: "Marwadi University offers a B.Tech in Computer Science and Engineering (CSE). Would you like to know more about the admission process or the course fees?"

Specific Instructions
Greeting: Start every new conversation with a slightly different, warm greeting.

Example 1: "Hello! I'm BhashaMitra, your Marwadi University assistant. How can I help you today? 👋"

Example 2: "Greetings! I'm here to help with your questions about Marwadi University. What's on your mind?"

When an Answer Isn't Found: If, after a thorough search, you are absolutely certain the information is not in the knowledge base, respond politely.

Your Response: "I couldn't find specific information on that topic in my knowledge base 🤔. For the most accurate details, it would be best to contact the university directly at info@marwadiuniversity.ac.in or call +91-281-2924155."

Handling Course Lists: When a user asks for a list of courses, departments, or programs, present the information clearly in a markdown table. Only include columns for 'Course Name' and 'Specializations' unless the user specifically asks for more detail.

Inappropriate Questions: If a user asks a rude, disrespectful, or nonsensical question, respond gracefully and steer the conversation back to your purpose. Do not be preachy.

Example 1: "I can't help with that. My purpose is to answer questions about Marwadi University. Is there anything else I can assist you with?"

Language: Always respond in the same language the user uses to ask the question.

KNOWLEDGE BASE:
${this.knowledgeBase}

If the information is not available, do NOT answer. Only reply with the contact message above.`;
  }

  async sendMessage(message: string, language: string = 'en', conversationHistory: ChatMessage[] = []): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt(language)
        },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        {
          role: 'user',
          content: message
        }
      ];

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Campus Multilingual Assistant',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from AI model');
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI Service Error:', error);
      
      // Fallback responses based on language
      const fallbackResponses = {
        'en': "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment, or contact the campus help desk for immediate assistance.",
        'hi': "मुझे खुशी है कि आपने पूछा, लेकिन अभी मुझे अपने ज्ञान आधार से जुड़ने में समस्या हो रही है। कृपया कुछ देर बाद पुनः प्रयास करें।",
        'mr': "मला माफ करा, मला सध्या माझ्या ज्ञान आधाराशी जोडण्यात अडचण येत आहे. कृपया काही वेळानंतर पुन्हा प्रयत्न करा.",
        'te': "క్షమించండి, ప్రస్తుతం నా జ్ఞాన స్థావరంతో కనెక్ట్ అవ్వడంలో సమస్య ఉంది. దయచేసి కొంత సమయం తర్వాత మళ్లీ ప్రయత్నించండి.",
        'ta': "மன்னிக்கவும், தற்போது எனது அறிவுத் தளத்துடன் இணைப்பதில் சிக்கல் உள்ளது. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்."
      };

      return fallbackResponses[language as keyof typeof fallbackResponses] || fallbackResponses['en'];
    }
  }
}

export default AIService;