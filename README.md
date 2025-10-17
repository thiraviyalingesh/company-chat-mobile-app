### Updated

16 - 10 -2025


# 1. Install with legacy-peer-deps --> HOME DIRECTORY --> In VS Code

  npm install --legacy-peer-deps


# 2 A. RUN WITH --> Terminal 1 --> In VS Code

  npm run build  

  or alternative

  npx react-native start --reset-cache  --> ALWAYS WORKS !!


# 2 B. Open Andriod Studio & start , JUST start the emluator!! --> In  Andriod Studio

  prev you did npm run android --> IT WIll take care remaining!! 



# 2 c. RUN WITH --> Terminal 2 --> In VS Code

Sometimes Android app will MAKE troube --> So use this command for alternative EMulator 

Terminal 2 (Emulator - Keep running): 

C:\Users\thira\AppData\Local\Android\Sdk\emulator\emulator.exe -avd Medium_Phone_API_36.1



### MOST IMPORTANT THING FOR TO GET A SUCCESSFUL BUILD!!

# 3. To get build --> Use cmd.exe via WSL (NOT direct WSL gradlew)  --> In VS Code

cd android

  cmd.exe /c gradlew.bat clean
  cmd.exe /c gradlew.bat assembleRelease


# 4. APK Location Details:  --> In File Manager / VS Code

  Location: D:\company_chat\CompanyChatMobile\android\app\build\outputs\apk\release\app-release.apk
  
  
### -------------------------------------------------------------------------------------------------------###

### Outdated

###LOCAL RUN

Terminal 2 (Build & Run):

cd D:\company_chat\CompanyChatMobile

npm run android

Emulator fails incase

Terminal 1 (Emulator - Keep running):

C:\Users\thira\AppData\Local\Android\Sdk\emulator\emulator.exe -avd Medium_Phone_API_36.1

# APK Build

# Build Signed Release APK

# Step 1: Clean Previous Build
cd D:\company_chat\CompanyChatMobile\android
./gradlew clean

# Step 2: Build Release APK
./gradlew assembleRelease

# Step 3: Locate APK

# APK Location:
D:\company_chat\CompanyChatMobile\android\app\build\outputs\apk\release\app-release.apk

### -----------------------------------------------------------------

### Keystore Details 

keystore password --> trunktalk@2025


PS D:\company_chat\CompanyChatMobile\android\app> keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
Enter keystore password:  

Re-enter new password: trunktalk@2025

What is your first and last name?
  [Unknown]:  Trunk talk
What is the name of your organizational unit?
  [Unknown]:  Trunk talk
What is the name of your organization?
  [Unknown]:  Buzztrackers
What is the name of your City or Locality?
  [Unknown]:  Buzztrackers
What is the name of your State or Province?
  [Unknown]:  Tamilnadu
What is the two-letter country code for this unit?
  [Unknown]:  IN
Is CN=Trunk talk, OU=Trunk talk, O=Buzztrackers, L=Buzztrackers, ST=Tamilnadu, C=IN correct?
  [no]:  yes

Generating 2,048 bit RSA key pair and self-signed certificate (SHA256withRSA) with a validity of 10,000 days
        for: CN=Trunk talk, OU=Trunk talk, O=Buzztrackers, L=Buzztrackers, ST=Tamilnadu, C=IN


--> [Storing my-release-key.keystore]
--> PS D:\company_chat\CompanyChatMobile\android\app>