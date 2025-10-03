# Quick Setup Guide - Company Chat Mobile

## Step-by-Step Setup

### 1. Prerequisites Check

- [ ] Node.js installed (v18 or higher, v20+ recommended)
- [ ] For Android: Android Studio with SDK installed
- [ ] For iOS: Xcode and CocoaPods installed (Mac only)
- [ ] Firebase project created (can reuse from web app)

### 2. Install Dependencies

```bash
cd CompanyChatMobile
npm install --legacy-peer-deps
```

For iOS (Mac only):
```bash
cd ios
pod install
cd ..
```

### 3. Firebase Configuration

#### Download Firebase Config Files

**Android:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Your Apps
4. Click "Add app" → Android
   - Package name: `com.companychatmobile`
   - Download `google-services.json`
5. Place the file at: `android/app/google-services.json`

**iOS (Mac only):**
1. In Firebase Console, add iOS app
   - Bundle ID: `org.reactjs.native.example.CompanyChatMobile`
   - Download `GoogleService-Info.plist`
2. Place the file at: `ios/CompanyChatMobile/GoogleService-Info.plist`

#### Enable Firebase Services

In Firebase Console, enable:
- ✅ Authentication → Email/Password provider
- ✅ Firestore Database
- ✅ Storage

### 4. Permissions Setup

#### Android Permissions (already configured in AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

#### iOS Permissions (add to ios/CompanyChatMobile/Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for chat messages</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to share images in chat</string>
```

### 5. Run the App

**Start Metro bundler:**
```bash
npm start
```

**Run on Android:**
```bash
# In a new terminal
npm run android
```

**Run on iOS (Mac only):**
```bash
# In a new terminal
npm run ios
```

### 6. Test the App

1. **Create an account:**
   - Tap "Sign Up"
   - Enter name, username, email, password
   - All signups create admin users by default

2. **Login:**
   - Use either username or email
   - Enter password

3. **Create a group:**
   - Tap "+ Create" button
   - Enter group name
   - Toggle "Create as Channel" if you want admin-only posting

4. **Send messages:**
   - Tap on a group
   - Type a message and tap Send
   - Tap camera icon to share images

## Common Setup Issues

### Issue: "Unable to resolve module"
**Solution:**
```bash
npx react-native start --reset-cache
npm install --legacy-peer-deps
```

### Issue: Android build fails with "google-services.json not found"
**Solution:**
- Verify file is at `android/app/google-services.json`
- File must be named exactly `google-services.json`
- Restart Android Studio/Metro bundler

### Issue: iOS build fails
**Solution:**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm run ios
```

### Issue: Camera/Gallery not working
**Solution:**
- Grant permissions in device settings
- iOS: Check Info.plist has camera/photo permissions
- Android: Check AndroidManifest.xml has permissions

### Issue: Firebase initialization error
**Solution:**
- Verify Firebase config files are in correct locations
- Check package name/bundle ID matches Firebase console
- Ensure Firebase services are enabled in console

## File Checklist

Ensure these files exist:

**Android:**
- [ ] `android/app/google-services.json` (from Firebase)

**iOS:**
- [ ] `ios/CompanyChatMobile/GoogleService-Info.plist` (from Firebase)

**Source Code:**
- [ ] `src/config/firebase.js`
- [ ] `src/context/AuthContext.js`
- [ ] `src/screens/Auth/LoginScreen.js`
- [ ] `src/screens/Auth/SignupScreen.js`
- [ ] `src/screens/DashboardScreen.js`
- [ ] `src/screens/Chat/ChatRoomScreen.js`
- [ ] `src/screens/Groups/CreateGroupModal.js`
- [ ] `App.tsx` (modified)

## What's Next?

After successful setup:

1. **Test on real device** - Connect phone via USB
2. **Add more features** - See README.md for ideas
3. **Deploy to stores** - Follow React Native deployment guides
4. **Add push notifications** - Use `@react-native-firebase/messaging`

## Resources

- [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)
- [React Native Firebase Docs](https://rnfirebase.io)
- [Android Studio Setup](https://developer.android.com/studio)
- [Xcode Setup](https://developer.apple.com/xcode/)
