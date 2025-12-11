# Firebase Phone Authentication Setup Guide

## Steps to Enable Phone Authentication in Firebase Console

1. **Go to Firebase Console**
   - Navigate to https://console.firebase.google.com/
   - Select your project: `strokesnchokes`

2. **Enable Phone Authentication**
   - Go to **Authentication** → **Sign-in method**
   - Find **Phone** in the list
   - Click on it and toggle **Enable**
   - Click **Save**

3. **Configure Authorized Domains (for Web)**
   - In Authentication → Settings → Authorized domains
   - Add your domains:
     - `localhost` (for development)
     - Your production domain (if applicable)

4. **For Android: Play Integrity API**
   - Firebase uses Play Integrity API (formerly SafetyNet) for automatic verification on Android
   - This should work automatically if your app is properly configured
   - No additional setup needed if using Firebase SDK

## Android Configuration

✅ **Already Completed:**
- Firebase dependencies added to `android/app/build.gradle`
- Google Services plugin configured
- `google-services.json` present

### ⚠️ CRITICAL: Add SHA-1 Fingerprint to Firebase

The `auth/invalid-app-credential` error occurs when Firebase can't verify your app. You **MUST** add your app's SHA-1 fingerprint to Firebase Console.

#### Steps to Add SHA-1 Fingerprint:

1. **Get your SHA-1 fingerprint:**

   **Option A: Using Gradle (if Java is configured)**
   
   First, set JAVA_HOME if you get an error:
   
   **On Windows:**
   ```powershell
   # Find your Java installation (usually in Program Files)
   # Example: C:\Program Files\Java\jdk-17
   
   # Set JAVA_HOME temporarily for this session:
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
   # Or wherever your JDK is installed
   
   # Then run:
   cd android
   .\gradlew signingReport
   ```
   
   **On Mac/Linux:**
   ```bash
   export JAVA_HOME=$(/usr/libexec/java_home)
   # Or set it to your JDK path
   cd android
   ./gradlew signingReport
   ```
   
   Look for the SHA-1 value under "Variant: debug" → "SHA1:"

   **Option B: Using keytool directly (EASIEST - if you have Android Studio installed)**
   
   Android Studio includes Java, so you can use its keytool:
   
   **For Debug builds (uses default debug keystore):**
   
   **On Windows PowerShell:**
   ```powershell
   # Use Android Studio's bundled Java (adjust path if needed)
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```
   
   **On Windows CMD:**
   ```cmd
   "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```
   
   **If Android Studio is in a different location, find it:**
   - Look for `keytool.exe` in: `C:\Program Files\Android\Android Studio\jbr\bin\`
   - Or search for "keytool.exe" on your system
   
   The debug keystore is usually at: `C:\Users\YourUsername\.android\debug.keystore`
   
   Look for the line that says **SHA1:** and copy that value
   
   **For Release builds:**
   - If you have a keystore file, use:
   ```bash
   keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
   ```
   - Enter your keystore password when prompted
   - Copy the SHA-1 value

   **Option C: Using Android Studio**
   - Open Android Studio
   - Open your project
   - Go to **Gradle** tab (right side)
   - Navigate to: `YourApp` → `Tasks` → `android` → `signingReport`
   - Double-click `signingReport`
   - Check the **Run** tab at the bottom for SHA-1 output

2. **Add SHA-1 to Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `strokesnchokes`
   - Go to **Project Settings** (gear icon)
   - Scroll down to **Your apps** section
   - Find your Android app (package: `com.strokesnchokes.strokesnchokes`)
   - Click **Add fingerprint**
   - Paste your SHA-1 fingerprint
   - Click **Save**

3. **Download updated google-services.json:**
   - After adding SHA-1, download the updated `google-services.json`
   - Replace the file in `android/app/google-services.json`
   - Rebuild your app

#### Important Notes:
- You need to add **both** debug and release SHA-1 fingerprints if you test with both
- After adding SHA-1, it may take a few minutes for Firebase to update
- You must rebuild your app after updating `google-services.json`

## Testing

- For testing, you can use test phone numbers in Firebase Console
- Go to Authentication → Sign-in method → Phone → Phone numbers for testing
- Add test numbers with verification codes

## Important Notes

- On Android, Firebase uses Play Integrity API for automatic verification
- This means reCAPTCHA is typically not required for native Android apps
- Since we're using Capacitor with Web SDK, the behavior may vary
- If you encounter issues, reCAPTCHA may be required as a fallback

