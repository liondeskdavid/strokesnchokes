# Testing Real Phone Numbers on Localhost

## Step-by-Step Guide

### Step 1: Add localhost to Firebase Authorized Domains

1. **Go to Firebase Console**
   - Navigate to: https://console.firebase.google.com/
   - Select your project: `strokesnchokes`

2. **Open Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on the **Settings** tab (gear icon at the top)
   - Scroll down to the **Authorized domains** section

3. **Add localhost**
   - Click the **Add domain** button
   - Enter: `localhost`
   - Click **Add**
   - You should see `localhost` appear in the list

4. **Optional: Add 127.0.0.1**
   - Click **Add domain** again
   - Enter: `127.0.0.1`
   - Click **Add**

### Step 2: Verify Your Setup

After adding localhost, your authorized domains should include:
- ✅ `localhost`
- ✅ `127.0.0.1` (optional)
- ✅ Your production domain (when ready)

### Step 3: Test the Flow

1. **Start your development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Open your app in the browser**
   - Go to: `http://localhost:5173` (or whatever port Vite uses)
   - Make sure you're using `localhost`, not `127.0.0.1` (though both should work)

3. **Enter a real phone number**
   - Format: `(555) 123-4567` (or any real US phone number)
   - The app will format it to `+1 (555) 123-4567`

4. **Complete reCAPTCHA**
   - You should see a reCAPTCHA checkbox appear (visible in development mode)
   - Click the checkbox to verify you're human
   - The reCAPTCHA should solve

5. **Submit and receive SMS**
   - Click "Send Verification Code"
   - You should receive an SMS with a 6-digit code
   - Enter the code to complete login

### Step 4: Troubleshooting

#### If reCAPTCHA doesn't appear:
- ✅ Check browser console for errors
- ✅ Verify `localhost` is in authorized domains
- ✅ Try refreshing the page
- ✅ Clear browser cache and cookies
- ✅ Try a different browser (Chrome, Firefox, Edge)

#### If you get "reCAPTCHA failed" error:
- ✅ Double-check `localhost` is in authorized domains
- ✅ Make sure you're accessing via `http://localhost:PORT`, not `http://127.0.0.1:PORT`
- ✅ Wait a few minutes after adding the domain (Firebase may need time to propagate)

#### If you get "Too many requests" error:
- ✅ Wait 5-10 minutes before trying again
- ✅ Use test phone numbers for development (they bypass rate limits)
- ✅ Check Firebase Console → Authentication → Usage for quota limits

#### If SMS doesn't arrive:
- ✅ Check your phone's spam/junk folder
- ✅ Verify the phone number format is correct
- ✅ Check Firebase Console → Authentication → Usage for SMS quota
- ✅ Make sure Phone Authentication is enabled in Firebase Console

### Step 5: Check Browser Console

Open your browser's developer console (F12) and look for:
- ✅ `Development mode: App verification disabled for testing` (if working)
- ✅ `reCAPTCHA rendered (development mode)` (if reCAPTCHA loads)
- ❌ Any red error messages (these will tell you what's wrong)

### Important Notes

1. **SMS Costs**: Real phone numbers will send actual SMS messages, which may count against your Firebase quota
2. **Rate Limits**: Firebase limits how many SMS codes you can request per phone number
3. **Test Numbers First**: Consider testing with Firebase test phone numbers first to verify the flow works
4. **Production**: When deploying to production, make sure to:
   - Add your production domain to authorized domains
   - Switch to invisible reCAPTCHA (already done in code)
   - Remove or disable `appVerificationDisabledForTesting`

### Quick Test Checklist

- [ ] `localhost` added to Firebase authorized domains
- [ ] App running on `http://localhost:PORT`
- [ ] Browser console shows no errors
- [ ] reCAPTCHA checkbox appears
- [ ] Can complete reCAPTCHA verification
- [ ] SMS code received
- [ ] Can verify code and log in

### Alternative: Use Test Phone Numbers First

Before testing with real numbers, you can verify everything works with test numbers:

1. **Add test phone number in Firebase Console**
   - Go to Authentication → Sign-in method → Phone
   - Open "Phone numbers for testing"
   - Add: `+1 650-555-3434` with code `123456`

2. **Test with the test number**
   - Enter `+1 650-555-3434` in your app
   - Use code `123456` (no SMS sent)
   - This verifies the flow works without SMS costs

3. **Then test with real number**
   - Once test number works, try a real number
   - This confirms reCAPTCHA is working properly

