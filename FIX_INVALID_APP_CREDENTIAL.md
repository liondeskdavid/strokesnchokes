# Fixing INVALID_APP_CREDENTIAL Error

## Error: `INVALID_APP_CREDENTIAL`

This error means Firebase cannot verify your app. This is different from reCAPTCHA issues - it's about app verification.

## For Localhost (Web Development)

### Step 1: Verify Authorized Domains

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select your project: `strokesnchokes`
3. Go to **Authentication** → **Settings** (gear icon)
4. Scroll to **Authorized domains**
5. **Verify** these are listed:
   - ✅ `localhost`
   - ✅ `127.0.0.1` (optional but recommended)
   - ✅ Your production domain (when ready)

6. If `localhost` is NOT there:
   - Click **Add domain**
   - Enter: `localhost`
   - Click **Add**

### Step 2: Check API Key Restrictions

1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Select project: `strokesnchokes`
3. Go to **APIs & Services** → **Credentials**
4. Find your API key: `AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`
5. Click on it to edit
6. Check **Application restrictions**:
   - If set to "HTTP referrers", make sure `localhost` is in the list
   - If set to "IP addresses", this might block localhost
   - **Recommended**: Set to "None" for development, or add `localhost` to HTTP referrers

7. Check **API restrictions**:
   - Should include "Identity Toolkit API" or be set to "Don't restrict key"
   - Should include "Firebase Authentication API" or be set to "Don't restrict key"

### Step 3: Verify Firebase Config

Check that your `firebase.js` has the correct config:
- `apiKey`: Should match the API key in Firebase Console
- `authDomain`: Should be `strokesnchokes.firebaseapp.com`
- `projectId`: Should be `strokesnchokes`

## For Android (Capacitor App)

### Step 1: Verify SHA-1 Fingerprint

1. **Get your SHA-1 fingerprint** (if not already done):
   ```bash
   cd android
   gradlew signingReport
   ```
   Or use Android Studio's keytool

2. **Add SHA-1 to Firebase Console**:
   - Go to Firebase Console → **Project Settings** (gear icon)
   - Scroll to **Your apps**
   - Find your Android app: `com.strokesnchokes.strokesnchokes`
   - Click **Add fingerprint**
   - Paste your SHA-1: `A8:5A:3F:32:6F:61:75:7C:EE:37:DD:4D:F6:7B:96:FA:4F:DC:62:83`
   - Click **Save**

3. **Download updated google-services.json**:
   - After adding SHA-1, download the updated `google-services.json`
   - Replace `android/app/google-services.json` with the new file
   - Rebuild your app

### Step 2: Verify Package Name

Check that these all match:
- ✅ `android/app/build.gradle`: `applicationId "com.strokesnchokes.strokesnchokes"`
- ✅ `android/app/build.gradle`: `namespace "com.strokesnchokes.strokesnchokes"`
- ✅ `google-services.json`: `package_name: "com.strokesnchokes.strokesnchokes"`
- ✅ `capacitor.config.json`: `appId: "com.strokesnchokes.strokesnchokes"`
- ✅ `MainActivity.java`: `package com.strokesnchokes.strokesnchokes;`

### Step 3: Clean and Rebuild

```bash
cd android
gradlew clean
gradlew assembleDebug
```

Then uninstall the old app and install the new build.

## Common Causes

1. **localhost not in authorized domains** (most common for web)
2. **API key restrictions** blocking localhost
3. **SHA-1 fingerprint not added** (for Android)
4. **Package name mismatch** (for Android)
5. **Outdated google-services.json** (for Android)

## Quick Checklist

### For Localhost Testing:
- [ ] `localhost` in Firebase authorized domains
- [ ] API key allows `localhost` or has no restrictions
- [ ] API key has Identity Toolkit API enabled
- [ ] Firebase config is correct

### For Android Testing:
- [ ] SHA-1 fingerprint added to Firebase Console
- [ ] Updated `google-services.json` downloaded and replaced
- [ ] Package name matches everywhere
- [ ] App rebuilt after changes
- [ ] Old app uninstalled before testing new build

## Still Not Working?

1. **Wait 5-10 minutes** after making changes (Firebase needs time to propagate)
2. **Clear browser cache** and cookies
3. **Try a different browser** (Chrome, Firefox, Edge)
4. **Check browser console** for additional error messages
5. **Verify Phone Authentication is enabled** in Firebase Console → Authentication → Sign-in method → Phone

## Important Notes

- Changes to authorized domains take effect immediately
- Changes to SHA-1 fingerprints may take a few minutes
- API key restrictions take effect immediately
- Always rebuild Android app after updating `google-services.json`

