###LOCAL RUN

Terminal 2 (Build & Run):
  
  
  cd D:\company_chat\CompanyChatMobile
  
  npm run android


Emulator fails incase 

Terminal 1 (Emulator - Keep running):

  C:\Users\thira\AppData\Local\Android\Sdk\emulator\emulator.exe -avd Medium_Phone_API_36.1



### APK Build



### Build Signed Release APK

#### Step 1: Clean Previous Build
```powershell
cd D:\company_chat\CompanyChatMobile\android
./gradlew clean
```

#### Step 2: Build Release APK
```powershell
./gradlew assembleRelease
```

#### Step 3: Locate APK
```powershell
# APK Location:
D:\company_chat\CompanyChatMobile\android\app\build\outputs\apk\release\app-release.apk
```
