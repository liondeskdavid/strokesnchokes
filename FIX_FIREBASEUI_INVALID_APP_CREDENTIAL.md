# Fixing INVALID_APP_CREDENTIAL with FirebaseUI

## Error: `auth/invalid-app-credential`

This error occurs when Firebase cannot verify your app. With FirebaseUI, this is usually due to:

1. **Domain not authorized**
2. **API key restrictions**
3. **Missing API enablement**

## Quick Fix Steps

### Step 1: Add localhost to Authorized Domains

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select your project: `strokesnchokes`
3. Go to **Authentication** → **Settings** (gear icon at top)
4. Scroll to **Authorized domains** section
5. **Check if `localhost` is listed**
   - If NOT listed: Click **Add domain** → Enter `localhost` → Click **Add**
   - Also add `127.0.0.1` (optional but recommended)

### Step 2: Check API Key in Google Cloud Console

1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Select project: `strokesnchokes`
3. Go to **APIs & Services** → **Credentials**
4. Find your **Browser API key** (the one used in `firebase.js`)
   - Current key in code: `AIzaSyA--bBHfUsqgjRKDOqY-lMSVJJBLR3SfuY`
5. Click on the API key to edit it
6. Check **Application restrictions**:
   - **Option A (Recommended for dev)**: Set to **"None"** (no restrictions)
   - **Option B**: If using "HTTP referrers", add:
     - `http://localhost:*`
     - `http://127.0.0.1:*`
     - Your production domain
7. Check **API restrictions**:
   - Should include **"Identity Toolkit API"** OR
   - Set to **"Don't restrict key"** (for development)

### Step 3: Enable Required APIs

1. In **Google Cloud Console**, go to **APIs & Services** → **Library**
2. Search for and enable:
   - ✅ **Identity Toolkit API**
   - ✅ **Firebase Authentication API**

### Step 4: Verify Firebase Config

Check `src/firebase.js`:
- `apiKey`: Should match the Browser key in Google Cloud Console
- `authDomain`: Should be `strokesnchokes.firebaseapp.com`
- `projectId`: Should be `strokesnchokes`

### Step 5: Clear Cache and Test

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** the page (Ctrl+Shift+R or Ctrl+F5)
3. **Try again**

## Common Issues

### Issue: "localhost not in authorized domains"
**Fix**: Add `localhost` to Firebase Console → Authentication → Settings → Authorized domains

### Issue: "API key restrictions blocking localhost"
**Fix**: In Google Cloud Console, set Application restrictions to "None" or add `http://localhost:*`

### Issue: "Identity Toolkit API not enabled"
**Fix**: Enable it in Google Cloud Console → APIs & Services → Library

### Issue: "Wrong API key"
**Fix**: Make sure you're using the **Browser key**, not the Android key, in `firebase.js`

## Verification Checklist

- [ ] `localhost` is in Firebase authorized domains
- [ ] API key has no Application restrictions OR includes `localhost`
- [ ] API key has Identity Toolkit API enabled
- [ ] Firebase Authentication API is enabled
- [ ] `firebase.js` has the correct Browser API key
- [ ] Browser cache cleared
- [ ] Page hard refreshed

## Still Not Working?

1. **Wait 5-10 minutes** after making changes (Firebase needs time to propagate)
2. **Check browser console** for the detailed error message (we added logging)
3. **Try a different browser** (Chrome, Firefox, Edge)
4. **Check the exact hostname** - the console will show what domain Firebase sees
5. **Verify Phone Authentication is enabled** in Firebase Console → Authentication → Sign-in method → Phone

## Important Notes

- Changes to authorized domains take effect **immediately**
- API key restriction changes take effect **immediately**
- API enablement may take a few minutes
- Always use the **Browser key** for web/Capacitor apps, not the Android key


