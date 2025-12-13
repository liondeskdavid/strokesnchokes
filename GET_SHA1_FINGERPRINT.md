# How to Fix "is not listed in per-application setting" Error

This error means your app's SHA-1 certificate fingerprint isn't registered in Firebase Console.

## Step 1: Get Your SHA-1 Fingerprint

### Option A: Using Gradle (Recommended)
```bash
cd android
.\gradlew.bat signingReport
```

Look for output like:
```
Variant: debug
Config: debug
Store: C:\Users\...\.android\debug.keystore
Alias: AndroidDebugKey
SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

### Option B: Using Android Studio
1. Open Android Studio
2. Open your project
3. Go to **Gradle** tab (right side panel)
4. Navigate to: `android` → `Tasks` → `android` → `signingReport`
5. Double-click `signingReport`
6. Check the **Run** tab at the bottom for SHA-1 output

### Option C: Using keytool (if you have a release keystore)
```bash
keytool -list -v -keystore your-keystore.keystore -alias your-alias
```

## Step 2: Add SHA-1 to Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **strokesnchokes**
3. Click the **gear icon** (⚙️) → **Project settings**
4. Scroll down to **Your apps** section
5. Find your Android app: `com.strokesnchokes.strokesnchokes`
6. Click **Add fingerprint** (or the pencil icon to edit)
7. Paste your SHA-1 fingerprint (with or without colons, both work)
8. Click **Save**

**Important:** You need to add BOTH:
- **Debug SHA-1** (for testing/development)
- **Release SHA-1** (for production builds)

## Step 3: Download Updated google-services.json

1. After adding SHA-1, scroll down in Firebase Console
2. Find your Android app again
3. Click **Download google-services.json**
4. Replace the file at: `android/app/google-services.json`
5. Also replace: `google-services.json` (root directory)

## Step 4: Rebuild Your App

```bash
# Clean build
cd android
.\gradlew.bat clean

# Rebuild
.\gradlew.bat assembleDebug
# or for release:
.\gradlew.bat assembleRelease
```

## Step 5: Uninstall and Reinstall

1. **Uninstall** the old app from your device
2. **Install** the newly built APK
3. Test again

## Current SHA-1s in google-services.json

Your `google-services.json` currently has these SHA-1 fingerprints:
- `a85a3f326f61757cee37dd4df67b96fa4fdc6283`
- `7fed74e043ae7d4c556675b4c8084b33dee473f4`

If your current build's SHA-1 doesn't match either of these, you need to add it to Firebase Console.

## Troubleshooting

- **Wait 5-10 minutes** after adding SHA-1 - Firebase needs time to propagate changes
- Make sure you're using the **correct keystore** (debug vs release)
- Verify the **package name** matches: `com.strokesnchokes.strokesnchokes`
- Check that you downloaded the **updated** google-services.json after adding SHA-1

