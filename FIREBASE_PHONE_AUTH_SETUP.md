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

## Testing

- For testing, you can use test phone numbers in Firebase Console
- Go to Authentication → Sign-in method → Phone → Phone numbers for testing
- Add test numbers with verification codes

## Important Notes

- On Android, Firebase uses Play Integrity API for automatic verification
- This means reCAPTCHA is typically not required for native Android apps
- Since we're using Capacitor with Web SDK, the behavior may vary
- If you encounter issues, reCAPTCHA may be required as a fallback

