# How to Check API Key Settings for Firebase Phone Authentication

## Step 1: Go to Google Cloud Console

1. Navigate to: https://console.cloud.google.com/
2. Make sure you're signed in with the account that has access to your Firebase project
3. Select your project: **`strokesnchokes`**

## Step 2: Navigate to API Key Settings

1. In the left sidebar, click **APIs & Services** → **Credentials**
2. Find your API key: **`AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`**
3. Click on the API key to open its settings

## Step 3: Check API Restrictions

1. Scroll down to the **API restrictions** section
2. You'll see one of two options:

### Option A: "Don't restrict key" ✅
- If this is selected, **all APIs are enabled** (including Identity Toolkit API)
- This is the simplest setup and works for development
- **No further action needed**

### Option B: "Restrict key" ⚠️
- If this is selected, you'll see a list of APIs
- **Check if these APIs are in the list:**
  - ✅ **Identity Toolkit API** (required for phone auth)
  - ✅ **Firebase Authentication API** (also helpful)
  - ✅ **Firebase Installations API** (may be needed)

3. **If Identity Toolkit API is NOT in the list:**
   - Click **Restrict key**
   - In the "Select APIs" dropdown, search for:
     - **Identity Toolkit API** → Check the box
     - **Firebase Authentication API** → Check the box (optional but recommended)
   - Click **Save**
   - Wait a few minutes for changes to propagate

## Step 4: Check Application Restrictions (Optional but Important)

While you're in the API key settings, also check **Application restrictions**:

1. Scroll to **Application restrictions**
2. For localhost development, you have two options:

### Option A: "None" ✅ (Easiest for development)
- No restrictions - works from any domain
- Good for development/testing
- **Recommended for localhost testing**

### Option B: "HTTP referrers" (More secure)
- If this is selected, you need to add:
  - `http://localhost:*` (allows any port)
  - `http://127.0.0.1:*` (allows any port)
  - Your production domain when ready

3. **If you're getting "INVALID_APP_CREDENTIAL" errors:**
   - Try changing to "None" temporarily to test
   - Or add `localhost` to the HTTP referrers list

## Step 5: Enable Identity Toolkit API (CRITICAL - Fixes AuthenticationService.SendVerificationCode Error)

If you're seeing `AuthenticationService.SendVerificationCode` errors, the Identity Toolkit API is likely not enabled:

1. Go to **APIs & Services** → **Library** (in the left sidebar)
2. In the search box, type: **"Identity Toolkit API"**
3. Click on **"Identity Toolkit API"** from the results
4. You'll see one of two things:

### If it shows "API enabled" ✅
- The API is already enabled
- Check API key restrictions instead (Step 3)

### If it shows "ENABLE" button ⚠️
- **Click the "ENABLE" button**
- Wait 1-2 minutes for it to activate
- You should see a confirmation message

### Alternative: Enable via Firebase Console
1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select project: `strokesnchokes`
3. Go to **Authentication** → **Sign-in method**
4. Make sure **Phone** is enabled
5. This should automatically enable Identity Toolkit API

## Step 6: Verify API is Enabled

After enabling, verify it's working:

1. Go back to **APIs & Services** → **Enabled APIs** (or **Library** → search "Identity Toolkit")
2. You should see **"Identity Toolkit API"** in the list with status **"Enabled"**
3. If you see errors in the API dashboard, check:
   - **Quotas** tab - make sure you haven't exceeded limits
   - **Metrics** tab - check for any error patterns

## Quick Checklist

- [ ] API key has **Identity Toolkit API** in restrictions (or "Don't restrict key")
- [ ] **Identity Toolkit API** is enabled for the project
- [ ] Application restrictions allow `localhost` (or set to "None")
- [ ] Changes have been saved
- [ ] Waited 2-5 minutes for changes to propagate

## Common Issues

### "API key restrictions don't allow this request"
- **Fix**: Add Identity Toolkit API to the API restrictions list
- Or set API restrictions to "Don't restrict key"

### "INVALID_APP_CREDENTIAL" on localhost
- **Fix**: Add `localhost` to HTTP referrers, or set Application restrictions to "None"

### API enabled but still not working
- **Fix**: Wait 5-10 minutes after enabling/changing settings
- Clear browser cache
- Try again

## Your Current API Key

- **Key**: `AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`
- **Project**: `strokesnchokes`
- **Required APIs**: Identity Toolkit API, Firebase Authentication API

