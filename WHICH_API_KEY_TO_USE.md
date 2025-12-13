# Which Firebase API Key to Use?

## Your Setup: Capacitor + Firebase Web SDK

Since you're using **Capacitor with Firebase Web SDK** (not native Android SDK), here's which key to use:

## Answer: Use the Browser Key ✅

**For your app, use the Browser key** because:
1. You're using Firebase **Web SDK** (not native Android SDK)
2. Capacitor runs your web app in a **WebView** (which is essentially a browser)
3. Even on Android, the Web SDK uses the **Browser key**

## API Keys Explained

### Browser Key (Use This One) ✅
- **Purpose**: For web applications and WebViews
- **Used by**: Firebase Web SDK
- **Works on**: 
  - Localhost/web browsers
  - Capacitor Android apps (WebView)
  - Capacitor iOS apps (WebView)
- **Location in code**: `src/firebase.js` → `apiKey` field

### Android Key (Don't Use This One) ❌
- **Purpose**: For native Android apps using Firebase Android SDK
- **Used by**: Firebase Android SDK (Java/Kotlin)
- **Works on**: Only native Android apps (not WebView)
- **Not used in**: Capacitor apps using Web SDK

## How to Verify Which Key You're Using

1. **Check your `src/firebase.js` file:**
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E",  // ← This should be your Browser key
     // ...
   };
   ```

2. **Check Google Cloud Console:**
   - Go to **APIs & Services** → **Credentials**
   - Find your **Browser key** - note its value
   - Find your **Android key** - note its value
   - Compare with the key in `firebase.js`

## Which Key Should Be in firebase.js?

**The Browser key** should be in your `firebase.js` file.

## Important Notes

### For Localhost Testing:
- Use **Browser key**
- Make sure `localhost` is in authorized domains
- Make sure Browser key has Identity Toolkit API enabled

### For Android Build (Capacitor):
- Still use **Browser key** (same one!)
- The WebView acts like a browser
- No need to change keys between web and Android

### For Native Android (If You Switch Later):
- Would use **Android key**
- Would use Firebase Android SDK (not Web SDK)
- Would need different code structure

## Current Configuration Check

Your current `firebase.js` has:
```javascript
apiKey: "AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E"
```

**Verify this matches your Browser key** in Google Cloud Console.

## If Keys Don't Match

If the key in `firebase.js` doesn't match your Browser key:

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Find your **Browser key**
3. Copy the key value
4. Update `src/firebase.js` with the Browser key
5. Make sure the Browser key has:
   - Identity Toolkit API enabled
   - Application restrictions allow localhost (or set to "None")

## Summary

- ✅ **Use Browser key** for Capacitor apps with Firebase Web SDK
- ❌ **Don't use Android key** (that's for native Android SDK only)
- 🔍 **Verify** the key in `firebase.js` matches your Browser key
- ⚙️ **Configure** Browser key to allow Identity Toolkit API and localhost

