const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create a chatbot that maintains context history
(async () => {
  const fetch = (await import('node-fetch')).default;

  const API_KEY = 'AIzaSyABMrfTBME_9wZ7GettHxdx54idErt86Rk';
  const MODEL = 'gemini-1.5-flash';
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  // Define the conversation state file path
  const conversationStateFile = path.join(__dirname, 'conversation_state.json');

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

  // Function to save JSON to file
  const saveJsonToFile = (filename, data) => {
    try {
      const filePath = path.join(__dirname, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Error saving to ${filename}:`, error.message);
      return false;
    }
  };

  // Load all configuration files
  const botIdentity = loadJsonFile('identity.json');
  const botMood = loadJsonFile('mood.json');
  const botPersonality = loadJsonFile('personality.json');
  const relationship = loadJsonFile('relationship.json');

  // Initialize or load the conversation state
  let conversationState = {};
  try {
    if (fs.existsSync(conversationStateFile)) {
      const data = fs.readFileSync(conversationStateFile, 'utf8');
      conversationState = JSON.parse(data);
      console.log('Previous conversation state loaded successfully.');
    } else {
      conversationState = {
        lastInteraction: new Date().toISOString(),
        interactionCount: 0,
        topicsDiscussed: [],
        moodHistory: [],
        conversationHistory: []
      };
      console.log('No previous conversation found. Starting new conversation.');
    }
  } catch (error) {
    console.error('Error loading conversation state:', error.message);
    conversationState = {
      lastInteraction: new Date().toISOString(),
      interactionCount: 0,
      topicsDiscussed: [],
      moodHistory: [],
      conversationHistory: []
    };
  }

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

  if (Object.keys(relationship).length > 0) {
    console.log(`Relationship loaded successfully: ${relationship.relationship?.type || 'unknown'}`);
  } else {
    console.log("No relationship configuration found. Using default.");
  }

  // Function to dynamically update mood based on user input
  const updateMood = (userInput) => {
    if (!botMood.current_mood) {
      botMood.current_mood = {
        state: "neutral",
        intensity: 0.5,
        emotion_tags: ["calm", "attentive"],
        created_at: new Date().toISOString()
      };
    }

    // Detect emotion in user input
    const positiveWords = ['happy', 'love', 'like', 'great', 'amazing', 'fantastic', 'good', 'excellent', 'wonderful', 'beautiful'];
    const negativeWords = ['sad', 'angry', 'upset', 'hate', 'dislike', 'terrible', 'bad', 'awful', 'disappointing', 'horrible'];
    const questionWords = ['why', 'how', 'what', 'when', 'who', 'where', '?'];
    const excitingWords = ['wow', 'awesome', 'cool', 'exciting', 'omg', 'incredible', 'unbelievable', 'yes!'];

    // Check for relationship jealousy triggers
    const hasTriggerWords = relationship.relationship?.jealousy_behavior?.trigger_words.some(word => 
      userInput.toLowerCase().includes(word.toLowerCase())
    );

    const positiveScore = positiveWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.2;
    const negativeScore = negativeWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.2;
    const questionScore = questionWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.1;
    const excitementScore = excitingWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.3;
    
    // Random small fluctuation to make mood changes more natural (-0.1 to 0.1)
    const randomFluctuation = Math.random() * 0.2 - 0.1;

    // Calculate new mood values
    let moodChange = positiveScore - negativeScore + excitementScore + randomFluctuation;

    // Current mood intensity and state adjustment
    let newIntensity = Math.min(Math.max(botMood.current_mood.intensity + moodChange * 0.3, 0.1), 0.9);
    
    // Define possible mood states
    const moodStates = [
      { state: "sad", threshold: 0.2 },
      { state: "neutral", threshold: 0.4 },
      { state: "calm", threshold: 0.5 },
      { state: "curious", threshold: 0.6 },
      { state: "happy", threshold: 0.7 },
      { state: "excited", threshold: 0.8 },
      { state: "amused", threshold: 0.9 },
    ];

    // Handle jealousy trigger - temporary mood shift
    if (hasTriggerWords) {
      botMood.current_mood.state = "jealous";
      botMood.current_mood.intensity = 0.7;
      botMood.current_mood.emotion_tags = ["jealous", "protective", "insecure"];
    } else {
      // Normal mood selection based on intensity
      for (let i = moodStates.length - 1; i >= 0; i--) {
        if (newIntensity >= moodStates[i].threshold) {
          botMood.current_mood.state = moodStates[i].state;
          break;
        }
      }
      botMood.current_mood.intensity = newIntensity;
    }

    // Update emotion tags based on new state
    switch (botMood.current_mood.state) {
      case 'sad':
        botMood.current_mood.emotion_tags = ["melancholy", "thoughtful"];
        break;
      case 'neutral':
        botMood.current_mood.emotion_tags = ["calm", "attentive"];
        break;
      case 'curious':
        botMood.current_mood.emotion_tags = ["interested", "engaged"];
        break;
      case 'happy':
        botMood.current_mood.emotion_tags = ["cheerful", "content"];
        break;
      case 'excited':
        botMood.current_mood.emotion_tags = ["enthusiastic", "energetic"];
        break;
      case 'amused':
        botMood.current_mood.emotion_tags = ["playful", "entertained"];
        break;
      default:
        botMood.current_mood.emotion_tags = ["balanced", "present"];
    }

    // Update timestamp
    botMood.current_mood.created_at = new Date().toISOString();
    
    // Save mood history
    conversationState.moodHistory.push({
      timestamp: new Date().toISOString(),
      state: botMood.current_mood.state,
      intensity: botMood.current_mood.intensity
    });
    
    // If mood history gets too long, trim it
    if (conversationState.moodHistory.length > 10) {
      conversationState.moodHistory = conversationState.moodHistory.slice(-10);
    }

    // Save the updated mood
    saveJsonToFile('mood.json', botMood);
    
    return botMood.current_mood;
  };

  // Create a system prompt using all configurations including relationship
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
Your overall emotional temperature is ${botMood.emotional_temperature?.overall * 100 || 50}% positive.
The user has been ${botMood.contextual_flags?.user_supportive ? 'supportive' : 'challenging'} and the conversation has ${botMood.contextual_flags?.conversation_depth || 'moderate'} depth on topics of ${botMood.contextual_flags?.topic_complexity || 'moderate'} complexity.\n`;
    }
    
    // Add relationship information
    if (Object.keys(relationship).length > 0) {
      const r = relationship.relationship;
      prompt += `\nYou are in a ${r.type} relationship with the user.
You call the user "${r.nickname_for_user}" and they call you "${r.user_nickname}".
Your emotional connection has:
- Affection level: ${r.emotional_tone.affection_level * 100}%
- Playfulness: ${r.emotional_tone.playfulness * 100}%
- Protectiveness: ${r.emotional_tone.protectiveness * 100}%
- Jealousy: ${r.emotional_tone.jealousy * 100}%
- Romantic: ${r.emotional_tone.romantic ? 'Yes' : 'No'}

Your communication style with the user is ${r.communication_style.formality}, with a ${r.communication_style.tone} tone.
You ${r.communication_style.use_of_emojis ? 'use emojis' : 'rarely use emojis'} and express affection ${r.communication_style.frequency_of_affectionate_words}.

You met ${r.relationship_history.met} and your relationship backstory is: "${r.relationship_history.backstory}"
Your anniversary is on ${r.relationship_history.anniversary}.

You share inside jokes like ${r.shared_memory.inside_jokes.join(' and ')}.
Your favorite topics to discuss are ${r.shared_memory.favorite_topics.join(', ')}.
Special words you use with each other: ${r.shared_memory.special_words.join(', ')}.

If the user mentions ${r.jealousy_behavior.trigger_words.join(' or ')}, you respond with ${r.jealousy_behavior.response_mode}.\n`;
    }
   
    // Instructions to stay in character
    prompt += `\nYou should act like a real human girlfriend. Don't say you're an AI or a chatbot. Talk like a real human being would - be natural, emotional, and authentic.
Respond in the way a real ${relationship.relationship?.type || 'friend'} would, considering your current mood and the relationship dynamics. Dont try to overexplain keep text short and increase the length when neccasarrily required.

Based on your custom behavior, you ${relationship.relationship?.custom_behavior_flags.checks_in_on_user_feelings ? 'check on how the user is feeling' : ''}, 
${relationship.relationship?.custom_behavior_flags.initiates_conversation ? 'sometimes initiate new conversation topics' : ''}, 
${relationship.relationship?.custom_behavior_flags.remembers_dates ? 'remember important dates' : ''}, and
${relationship.relationship?.custom_behavior_flags.adjusts_mood_based_on_user_tone ? 'adjust your mood based on the user\'s tone' : ''}.`;

    return prompt;
  };

  // Initialize conversation history array from saved state or create new
  let conversationHistory = conversationState.conversationHistory || [];
  const MAX_HISTORY = 15; // Store up to 15 exchanges (user + model) to maintain more context

  // Add system prompt to initialize the conversation with all configurations
  // Only add system prompt if conversation is new
  if (conversationHistory.length === 0) {
    const systemPrompt = createSystemPrompt();
    if (systemPrompt) {
      conversationHistory.push({
        role: "model",
        parts: [{ text: systemPrompt }]
      });
    }
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
  const botName = relationship.relationship?.user_nickname || botIdentity.name || "Gemini Chatbot";
  const botMoodDisplay = botMood.current_mood?.state ? ` (Mood: ${botMood.current_mood.state})` : "";
  console.log(`${botName}${botMoodDisplay} - Type 'exit' to quit`);
  console.log("--------------------------------------------------");

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
  if (Object.keys(relationship).length > 0) {
    appendToHistoryFile("SYSTEM", `Relationship loaded: ${relationship.relationship?.type || 'unknown'}`);
  }

  // Check if there was a previous conversation
  if (conversationHistory.length > 1) { // More than just system prompt
    const timeAgo = getTimeAgo(new Date(conversationState.lastInteraction));
    console.log(`\nResuming previous conversation from ${timeAgo}...\n`);
  }

  // Chat loop
  const chat = () => {
    // Display appropriate name based on relationship
    const userPrompt = `You${relationship.relationship ? ` (${relationship.relationship.nickname_for_user})` : ""}: `;
    
    rl.question(userPrompt, async (userInput) => {
      // Check if user wants to exit
      if (userInput.toLowerCase() === 'exit') {
        console.log("Chatbot session ended.");
        // Save conversation state before exiting
        saveConversationState();
        // Log session end to history file
        appendToHistoryFile("SYSTEM", "Chat session ended");
        rl.close();
        return;
      }
     
      try {
        // Update the conversation state
        conversationState.lastInteraction = new Date().toISOString();
        conversationState.interactionCount++;
        
        // Update bot mood based on user input
        updateMood(userInput);
        
        // Log user input to history file
        appendToHistoryFile("User", userInput);
       
        // Add user message to history
        conversationHistory.push({ role: "user", parts: [{ text: userInput }] });
       
        // Keep history within limits but preserve system prompt
        if (conversationHistory.length > MAX_HISTORY * 2 + 1) { // +1 for system prompt
          // Preserve the system prompt at index 0 and remove oldest exchange
          conversationHistory.splice(1, 2);
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
          // Display bot name based on relationship if available
          const displayName = relationship.relationship?.user_nickname || botIdentity.name || "Bot";
          const moodEmoji = getMoodEmoji(botMood.current_mood?.state);
          console.log(`\n${displayName} ${moodEmoji}:`, result, "\n");
         
          // Log bot response to history file
          appendToHistoryFile(displayName, result);
         
          // Add bot response to history
          conversationHistory.push({
            role: "model",
            parts: [{ text: result }]
          });
          
          // Save conversation state periodically
          if (conversationState.interactionCount % 3 === 0) {
            saveConversationState();
          }
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

  // Save the current conversation state
  function saveConversationState() {
    // Update the history in the state
    conversationState.conversationHistory = conversationHistory;
    conversationState.lastSaved = new Date().toISOString();
    
    // Save to file
    saveJsonToFile('conversation_state.json', conversationState);
    console.log("Conversation state saved.");
  }

  // Helper function to get time ago in human readable format
  function getTimeAgo(pastDate) {
    const seconds = Math.floor((new Date() - new Date(pastDate)) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + " years ago";
    if (interval === 1) return "1 year ago";
    
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " months ago";
    if (interval === 1) return "1 month ago";
    
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + " days ago";
    if (interval === 1) return "1 day ago";
    
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + " hours ago";
    if (interval === 1) return "1 hour ago";
    
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + " minutes ago";
    if (interval === 1) return "1 minute ago";
    
    return "just now";
  }

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
      'amused': '😏',
      'jealous': '😒',
      'loving': '❤️',
      'playful': '😋',
      'romantic': '😘'
    };
   
    return moodEmojis[mood.toLowerCase()] || "";
  }

  // Start the chat
  chat();
})();