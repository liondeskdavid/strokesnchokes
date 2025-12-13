# How to Find Your Firebase App ID

## What is appId?

The `appId` (also called `mobilesdk_app_id`) is a unique identifier for your Firebase app. It's used in your Firebase configuration.

## Where to Find appId

### Option 1: Firebase Console (Easiest)

1. **Go to Firebase Console**
   - Navigate to: https://console.firebase.google.com/
   - Select your project: **`strokesnchokes`**

2. **Go to Project Settings**
   - Click the **gear icon** (⚙️) next to "Project Overview"
   - Click **"Project settings"**

3. **Find Your App**
   - Scroll down to **"Your apps"** section
   - You'll see your apps listed (Web, Android, iOS, etc.)
   - Find your **Android app** (package: `com.strokesnchokes.strokesnchokes`)

4. **Get the App ID**
   - Under your Android app, you'll see:
     - **App ID**: `1:853506983444:android:1d60b493b5bda804c40901` ← This is your appId
     - Package name: `com.strokesnchokes.strokesnchokes`
     - SHA-1 fingerprints: (your SHA-1 values)

### Option 2: google-services.json File

1. **Open `google-services.json`**
   - Located at: `android/app/google-services.json`
   - Or: `google-services.json` (root)

2. **Find mobilesdk_app_id**
   ```json
   {
     "client": [
       {
         "client_info": {
           "mobilesdk_app_id": "1:853506983444:android:1d60b493b5bda804c40901",  ← This is your appId
           "android_client_info": {
             "package_name": "com.strokesnchokes.strokesnchokes"
           }
         }
       }
     ]
   }
   ```

### Option 3: Firebase Console → Project Settings → General

1. Go to **Firebase Console** → **Project Settings**
2. Scroll to **"Your apps"** section
3. Click on your **Android app**
4. The **App ID** is displayed at the top

## Your Current appId

Based on your `google-services.json`, your appId is:
```
1:853506983444:android:1d60b493b5bda804c40901
```

## Format Explained

The appId format is:
```
{project_number}:{platform}:{app_id_hash}
```

For your app:
- `1:853506983444:android:1d60b493b5bda804c40901`
- `1` = App number (first app = 1)
- `853506983444` = Project number
- `android` = Platform
- `1d60b493b5bda804c40901` = Unique app identifier

## For Web Apps

If you also have a **Web app** in Firebase:
- The appId format is: `1:853506983444:web:{web_app_id}`
- You can find it in Firebase Console → Project Settings → Your apps → Web app

## Important Notes

1. **Different platforms = Different appIds**
   - Android app has one appId
   - Web app has a different appId
   - iOS app has another appId

2. **For Capacitor with Web SDK**
   - You might use the **Web appId** instead of Android appId
   - Check which one works for your setup

3. **Current Configuration**
   - Your `firebase.js` uses: `1:853506983444:android:1d60b493b5bda804c40901`
   - This matches your `google-services.json`
   - This is correct for Android builds

## Quick Checklist

- [ ] Go to Firebase Console → Project Settings
- [ ] Scroll to "Your apps" section
- [ ] Find your Android app
- [ ] Copy the App ID
- [ ] Verify it matches your `firebase.js` config
- [ ] If different, update `firebase.js` with the correct appId

## If You Need to Create a Web App

If you want to use a Web appId instead:

1. Go to Firebase Console → Project Settings
2. Scroll to "Your apps" section
3. Click **"Add app"** → Select **Web** (</> icon)
4. Register your app (give it a nickname)
5. Copy the config that appears
6. Use the Web appId in your `firebase.js`

## Your Current Setup

Based on your files:
- **Current appId**: `1:853506983444:android:1d60b493b5bda804c40901`
- **Location**: `src/firebase.js` and `src/App.jsx`
- **Source**: `google-services.json`

This appears to be correct for your Android app configuration.

