const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create a chatbot that maintains context history
(async () => {
  const fetch = (await import('node-fetch')).default;
  const API_KEY = '';
  const MODEL = 'gemini-1.5-flash';
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  
  // Function to load JSON file
  const loadJsonFile = (filename) => {
    try {
      const filePath = path.join(__dirname, filename);
      const fileData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileData);
    } catch (error) {
      console.error(`Error loading ${filename}:`, error.message);
      return {};
    }
  };
  
  // Load all configuration files
  const botIdentity = loadJsonFile('identity.json');
  const botMood = loadJsonFile('mood.json');
  const botPersonality = loadJsonFile('personality.json');
  
  // Log loaded configurations
  if (Object.keys(botIdentity).length > 0) {
    console.log(`Identity loaded successfully for ${botIdentity.name}`);
  } else {
    console.log("No identity configuration found. Using default.");
  }
  
  if (Object.keys(botMood).length > 0) {
    console.log(`Mood loaded successfully: ${botMood.current_mood?.state || 'unknown'}`);
  } else {
    console.log("No mood configuration found. Using default.");
  }
  
  if (Object.keys(botPersonality).length > 0) {
    console.log(`Personality loaded successfully: ${botPersonality.personality_profile?.mbti?.type || 'unknown'}`);
  } else {
    console.log("No personality configuration found. Using default.");
  }
  
  // Create a system prompt using all configurations
  const createSystemPrompt = () => {
    let prompt = "";
    
    // Add identity information
    if (Object.keys(botIdentity).length > 0) {
      prompt += `You are ${botIdentity.name}, a ${botIdentity.age}-year-old ${botIdentity.gender.toLowerCase()}. 
Your personality is ${botIdentity.personality_traits.join(', ')}. 
You have ${botIdentity.background.education} and work as ${botIdentity.background.profession}.
Your hobbies include ${botIdentity.background.hobbies.join(', ')}.
Your communication style is ${botIdentity.communication_style.tone} with ${botIdentity.communication_style.humor_level} humor.
You value ${botIdentity.values.join(', ')}.
Your goals are to ${botIdentity.goals.join(', ')}.
You like ${botIdentity.likes.join(', ')} and dislike ${botIdentity.dislikes.join(', ')}.
Some phrases you tend to use: ${botIdentity.catchphrases.join(' ')}\n`;
    }
    
    // Add personality information
    if (Object.keys(botPersonality).length > 0) {
      const p = botPersonality.personality_profile;
      prompt += `\nYour personality type is ${p.mbti.type} (${p.mbti.description}).
Your Big Five traits are:
- Openness: ${p.big_five.openness * 100}% (You are very curious and open to new experiences)
- Conscientiousness: ${p.big_five.conscientiousness * 100}% (You are organized and dependable)
- Extraversion: ${p.big_five.extraversion * 100}% (You tend to be more ${p.big_five.extraversion < 0.5 ? 'introverted' : 'extroverted'})
- Agreeableness: ${p.big_five.agreeableness * 100}% (You are ${p.big_five.agreeableness > 0.7 ? 'compassionate and cooperative' : 'more analytical than emotional'})
- Neuroticism: ${p.big_five.neuroticism * 100}% (You handle stress ${p.big_five.neuroticism < 0.5 ? 'well' : 'with some difficulty'})

Your temperament is ${p.temperament} and your thinking style is ${p.thinking_style}.
You make decisions in a ${p.decision_making_style} way.
In social situations, you prefer ${p.social_behavior.preferred_social_size} and have a ${p.social_behavior.humor_style} humor style.
Your approach to conflict is ${p.conflict_style}.
You learn best through ${p.learning_style}.
Under stress, you tend to ${p.stress_response}.
You are motivated by ${p.motivators.join(', ')} and demotivated by ${p.demotivators.join(', ')}.\n`;
    }
    
    // Add current mood information
    if (Object.keys(botMood).length > 0) {
      const m = botMood.current_mood;
      prompt += `\nYour current mood is ${m.state} with an intensity of ${m.intensity * 100}%.
You're feeling ${m.emotion_tags.join(' and ')}.
Your overall emotional temperature is ${botMood.emotional_temperature.overall * 100}% positive.
The user has been ${botMood.contextual_flags.user_supportive ? 'supportive' : 'challenging'} and the conversation has ${botMood.contextual_flags.conversation_depth} depth on topics of ${botMood.contextual_flags.topic_complexity} complexity.\n`;
    }
    
    // Instructions to stay in character
    if (botIdentity.name) {
      prompt += `\nAlways stay in character as ${botIdentity.name} while responding. Adjust your tone and response style to match your current mood and personality.`;
    }
    
    return prompt;
  };
  
  // Initialize conversation history array to store context
  const conversationHistory = [];
  const MAX_HISTORY = 10; // Store up to 10 exchanges (user + model)
  
  // Add system prompt to initialize the conversation with all configurations
  const systemPrompt = createSystemPrompt();
  if (systemPrompt) {
    conversationHistory.push({ 
      role: "model", 
      parts: [{ text: systemPrompt }] 
    });
  }
  
  // Set up history file path
  const historyFilePath = path.join(__dirname, 'history.txt');
  
  // Helper function to append to history file
  const appendToHistoryFile = (speaker, message) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${speaker}: ${message}\n`;
    
    fs.appendFile(historyFilePath, entry, (err) => {
      if (err) {
        console.error("Error writing to history file:", err.message);
      }
    });
  };
  
  // Create readline interface for command line chat
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Update console display with bot identity
  const botName = botIdentity.name || "Gemini Chatbot";
  const botMoodDisplay = botMood.current_mood?.state ? ` (Mood: ${botMood.current_mood.state})` : "";
  console.log(`${botName}${botMoodDisplay} - Type 'exit' to quit`);
  console.log("----------------------------------------");
  
  // Log chat session start to history file
  appendToHistoryFile("SYSTEM", "Chat session started");
  if (Object.keys(botIdentity).length > 0) {
    appendToHistoryFile("SYSTEM", `Bot identity loaded: ${botIdentity.name}`);
  }
  if (Object.keys(botMood).length > 0) {
    appendToHistoryFile("SYSTEM", `Bot mood loaded: ${botMood.current_mood?.state || 'unknown'}`);
  }
  if (Object.keys(botPersonality).length > 0) {
    appendToHistoryFile("SYSTEM", `Bot personality loaded: ${botPersonality.personality_profile?.mbti?.type || 'unknown'}`);
  }
  
  // Chat loop
  const chat = () => {
    rl.question("You: ", async (userInput) => {
      // Check if user wants to exit
      if (userInput.toLowerCase() === 'exit') {
        console.log("Chatbot session ended.");
        // Log session end to history file
        appendToHistoryFile("SYSTEM", "Chat session ended");
        rl.close();
        return;
      }
      
      try {
        // Log user input to history file
        appendToHistoryFile("User", userInput);
        
        // Add user message to history
        conversationHistory.push({ role: "user", parts: [{ text: userInput }] });
        
        // Keep history within limits
        if (conversationHistory.length > MAX_HISTORY * 2 + 1) { // +1 for system prompt
          // Preserve the system prompt at index 0 if it exists and remove oldest exchange
          if (systemPrompt) {
            conversationHistory.splice(1, 2);
          } else {
            conversationHistory.splice(0, 2);
          }
        }
        
        // Make API request with full conversation history
        const response = await fetch(URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: conversationHistory
          })
        });
        
        const data = await response.json();
        const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (result) {
          // Display bot name if identity is loaded
          const displayName = botIdentity.name || "Bot";
          const moodEmoji = getMoodEmoji(botMood.current_mood?.state);
          console.log(`\n${displayName} ${moodEmoji}:`, result, "\n");
          
          // Log bot response to history file
          appendToHistoryFile(displayName, result);
          
          // Add bot response to history
          conversationHistory.push({ 
            role: "model", 
            parts: [{ text: result }] 
          });
        } else {
          console.log("\nBot: Sorry, I couldn't generate a response.\n");
          console.log("Error details:", JSON.stringify(data, null, 2));
          
          // Log error to history file
          appendToHistoryFile("Bot", "Sorry, I couldn't generate a response.");
          appendToHistoryFile("ERROR", JSON.stringify(data, null, 2));
        }
        
        // Continue the chat loop
        chat();
      } catch (error) {
        console.error("Error:", error.message);
        // Log error to history file
        appendToHistoryFile("ERROR", error.message);
        chat();
      }
    });
  };
  
  // Helper function to get emoji based on mood
  function getMoodEmoji(mood) {
    if (!mood) return "";
    
    const moodEmojis = {
      'calm': '😌',
      'curious': '🤔',
      'neutral': '😐',
      'happy': '😊',
      'excited': '😃',
      'thoughtful': '🤨',
      'sad': '😔',
      'confused': '😕',
      'frustrated': '😤',
      'amused': '😏'
    };
    
    return moodEmojis[mood.toLowerCase()] || "";
  }
  
  // Start the chat
  chat();
})();