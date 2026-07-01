import fs from "fs";
import path from "path";

/**
 * Loads environment variables from available environment files
 * in prioritized order (.env.local -> env.local -> .env -> env).
 * Cleans carriage returns (\r) and handles different line ending formats correctly.
 */
export function loadEnv() {
  const envFiles = [".env.local", "env.local", ".env", "env"];
  const rootDir = process.cwd();
  let loadedFile = null;

  for (const file of envFiles) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        loadedFile = file;
        
        // Split by line breaks, supporting both \r\n and \n
        const lines = content.split(/\r?\n/);
        
        for (let line of lines) {
          line = line.trim();
          
          // Skip empty lines and comments
          if (!line || line.startsWith("#")) {
            continue;
          }
          
          const equalIndex = line.indexOf("=");
          if (equalIndex > 0) {
            const key = line.substring(0, equalIndex).trim();
            let val = line.substring(equalIndex + 1).trim();
            
            // Remove surrounding quotes if they exist
            val = val.replace(/^["']|["']$/g, "");
            
            // Only set if process.env[key] is not defined or is a default placeholder
            if (!process.env[key] || process.env[key].startsWith("replace_with_")) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn(`[WARN] Failed to load env file ${file}:`, err);
      }
    }
  }

  if (loadedFile) {
    // Also override DATABASE_URL and other crucial variables in case they were set with placeholder
    // values by Next.js from a dummy .env.local file.
    const keysToCheck = [
      "CHAKRA_API_KEY",
      "CHAKRA_PLUGIN_ID",
      "CHAKRA_WABA_ID",
      "CHAKRA_PHONE_ID",
      "SARVAM_API_KEY",
      "OWNER_PHONE",
      "DATABASE_URL",
      "NEXT_PUBLIC_TUNNEL_URL"
    ];
    
    // For these keys, if they currently have placeholders in process.env, make sure we force-load 
    // the value from our found file.
    try {
      const filePath = path.join(rootDir, loadedFile);
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/);
      
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("#")) continue;
        
        const equalIndex = line.indexOf("=");
        if (equalIndex > 0) {
          const key = line.substring(0, equalIndex).trim();
          let val = line.substring(equalIndex + 1).trim();
          val = val.replace(/^["']|["']$/g, "");
          
          if (keysToCheck.includes(key) && val && !val.startsWith("replace_with_")) {
            // Overwrite if process.env is empty or is a placeholder
            if (!process.env[key] || process.env[key].startsWith("replace_with_")) {
              process.env[key] = val;
            }
          }
        }
      }
    } catch (err) {
      // Ignored
    }
  }
}
