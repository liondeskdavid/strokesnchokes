# Troubleshooting Firebase Phone Authentication

## Error: auth/invalid-app-credential

This error occurs when Firebase can't verify your app. Here are the steps to fix it:

### ✅ Verification Checklist:

1. **SHA-1 Fingerprint Added to Firebase Console**
   - ✅ Your SHA-1: `A8:5A:3F:32:6F:61:75:7C:EE:37:DD:4D:F6:7B:96:FA:4F:DC:62:83`
   - Go to Firebase Console → Project Settings → Your apps
   - Verify it's listed for `com.strokesnchokes.strokesnchokes`

2. **google-services.json Updated**
   - ✅ File is present at `android/app/google-services.json`
   - ✅ Contains the SHA-1 in `oauth_client[0].android_info.certificate_hash`
   - ✅ Package name matches: `com.strokesnchokes.strokesnchokes`

3. **Package Name Consistency**
   - ✅ `android/app/build.gradle`: `com.strokesnchokes.strokesnchokes`
   - ✅ `google-services.json`: `com.strokesnchokes.strokesnchokes`
   - ⚠️ Check: `MainActivity.java` package declaration
   - ⚠️ Check: `capacitor.config.json` appId

### 🔧 Fix Steps:

1. **Clean and Rebuild:**
   ```bash
   cd android
   gradlew clean
   gradlew assembleDebug
   ```

2. **Uninstall Old App:**
   - Completely uninstall the app from your device/emulator
   - This ensures the old credentials are cleared

3. **Reinstall Fresh Build:**
   - Install the newly built APK
   - Test phone authentication

4. **Wait for Firebase Propagation:**
   - After adding SHA-1, wait 5-10 minutes for Firebase to update
   - Sometimes changes take time to propagate

### ⚠️ Important Notes for Capacitor Apps:

Since you're using **Capacitor with Firebase Web SDK** (not native Android SDK), there are some considerations:

1. **Web SDK vs Native SDK:**
   - The Web SDK still requires reCAPTCHA for phone auth
   - Even though you're on Android, the Web SDK runs in a WebView
   - The invisible reCAPTCHA should handle this automatically

2. **If Still Getting Errors:**
   - Try using a visible reCAPTCHA temporarily to see if that's the issue
   - Check browser console for any additional errors
   - Verify Phone Authentication is enabled in Firebase Console

3. **Alternative: Use Native Firebase SDK**
   - For better Android integration, consider using Capacitor Firebase plugin
   - This would use native Android Firebase SDK instead of Web SDK

### 🔍 Debug Steps:

1. Check Firebase Console:
   - Authentication → Sign-in method → Phone → Should be **Enabled**
   - Project Settings → Your apps → Verify SHA-1 is listed

2. Check App Logs:
   - Look for any Firebase initialization errors
   - Check if google-services.json is being loaded

3. Verify Build:
   - Make sure you're testing with the same build that has the updated google-services.json
   - Don't test with an old APK

### Still Not Working?

If after all these steps it still doesn't work:
1. Double-check the SHA-1 fingerprint matches exactly
2. Try adding both debug AND release SHA-1 fingerprints
3. Consider using Firebase test phone numbers first to verify the flow works
4. Check if there are any network/firewall issues blocking Firebase

