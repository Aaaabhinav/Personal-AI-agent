const readline = require('readline');

// Create a chatbot that maintains context history
(async () => {
  const fetch = (await import('node-fetch')).default;
  const API_KEY = '';
  const MODEL = 'gemini-1.5-flash';
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  
  // Initialize conversation history array to store context
  const conversationHistory = [];
  const MAX_HISTORY = 10; // Store up to 10 exchanges (user + model)
  
  // Create readline interface for command line chat
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log("Gemini Chatbot - Type 'exit' to quit");
  console.log("----------------------------------------");
  
  // Chat loop
  const chat = () => {
    rl.question("You: ", async (userInput) => {
      // Check if user wants to exit
      if (userInput.toLowerCase() === 'exit') {
        console.log("Chatbot session ended.");
        rl.close();
        return;
      }
      
      try {
        // Add user message to history
        conversationHistory.push({ role: "user", parts: [{ text: userInput }] });
        
        // Keep history within limits
        if (conversationHistory.length > MAX_HISTORY * 2) { // *2 because each exchange has two entries
          conversationHistory.splice(0, 2); // Remove oldest exchange (user + model)
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
          console.log("\nBot:", result, "\n");
          
          // Add bot response to history
          conversationHistory.push({ 
            role: "model", 
            parts: [{ text: result }] 
          });
        } else {
          console.log("\nBot: Sorry, I couldn't generate a response.\n");
          console.log("Error details:", JSON.stringify(data, null, 2));
        }
        
        // Continue the chat loop
        chat();
      } catch (error) {
        console.error("Error:", error.message);
        chat();
      }
    });
  };
  
  // Start the chat
  chat();
})();