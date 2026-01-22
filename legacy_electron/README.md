# 📸 Instagram Profile Scraper - Electron App

Desktop application built with Electron and Puppeteer to automatically extract data from Instagram profiles.

**Created by:** Guedes, Hugo

> **📦 Using the installed app?** See [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) for configuration after build.

---

## 🎯 Features

- ✅ **Desktop Application** - Native cross-platform app (Windows, macOS, Linux)
- ✅ **User-Friendly Interface** - Modern, dark-themed UI with real-time feedback
- ✅ **Batch Processing** - Process multiple Instagram accounts from CSV
- ✅ **Session Management** - Keeps Instagram login session between runs
- ✅ **Robust Error Handling** - Automatic retry and error recovery
- ✅ **Real-time Progress** - Live logs and progress tracking
- ✅ **Results Export** - JSON files with success and error data

---

## 📋 Prerequisites

- **Node.js** 16.x or higher
- **Google Chrome** installed on your system
- **Instagram Account** credentials

---

## 🚀 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Instagram Credentials

Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Then edit the `.env` file and add your Instagram credentials:

```env
INSTAGRAM_USERNAME=your_username_here
INSTAGRAM_PASSWORD=your_password_here
MAX_POSTS_PER_ACCOUNT=50
DELAY_BETWEEN_ACCOUNTS=3000
```

⚠️ **IMPORTANT:** 
- The `.env` file is already in `.gitignore` and will NOT be committed to Git
- Never commit your credentials to public repositories!
- Keep your `.env` file secure and private

---

## 📁 Project Structure

```
instagram-scraper-electron/
├── main.js                          # Electron Main Process
├── preload.js                       # Secure IPC Bridge
├── package.json                     # Dependencies and scripts
├── src/
│   ├── renderer/                    # Frontend (UI)
│   │   ├── index.html              # Main interface
│   │   ├── styles.css              # Modern styling
│   │   └── renderer.js             # Frontend logic
│   └── scraper/                     # Backend (Scraping)
│       ├── instagram-scraper.js    # Main scraping module
│       ├── utils.js                # Utility functions
│       └── const.js                # Configuration constants
└── ports/                           # Data directories
    ├── input/                       # CSV files
    ├── output/                      # Results (JSON)
    └── cookies/                     # Session cookies
```

---

## 🎮 Usage

### 1. Start the Application

```bash
npm start
```

### 2. Upload CSV File

1. Click on "📁 Select CSV File"
2. Choose a CSV file with Instagram usernames (one per line)

**Example CSV format:**
```
@username1
@username2
username3
username4
```

### 3. Start Scraping

1. Click "▶️ Start Scraping"
2. Watch real-time progress and logs
3. Results will be saved automatically

### 4. View Results

Click "📂 Open Results Folder" to see:
- `success.json` - Successfully scraped accounts
- `errors.json` - Failed accounts with error details

---

## 🔧 Configuration

### Chrome Path

If Chrome is installed in a non-standard location, update `src/scraper/utils.js`:

```javascript
function chromePath() {
  // Update paths for your system
  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  // ... other platforms
}
```

### Scraping Settings

Adjust timeouts and retry settings in `src/scraper/instagram-scraper.js`:

```javascript
const MAX_LOGIN_RETRIES = 3;          // Login retry attempts
const MAX_ACCOUNT_RETRIES = 2;        // Account processing retries
const ACCOUNT_TIMEOUT = 60000;        // Timeout per account (ms)
const DELAY_BETWEEN_ACCOUNTS = 3000;  // Delay between accounts (ms)
```

---

## 🛠️ Building for Distribution

### Build for Current Platform

```bash
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
```

### Build for All Platforms

```bash
npm run build:all
```

Built apps will be in the `dist/` folder.

---

## 🎨 Customization

### Adding Scraping Logic

Edit `src/scraper/instagram-scraper.js` in the `processAccount()` function:

```javascript
async function processAccount(page, account, index, total) {
  // Your scraping logic here

  // Example: Extract followers
  const followers = await page.$eval('selector', el => el.textContent);
  scrapedData.followers = followers;

  // Example: Extract bio
  const bio = await page.$eval('selector', el => el.textContent);
  scrapedData.bio = bio;

  return {
    success: true,
    data: scrapedData
  };
}
```

### Instagram Selectors

If Instagram updates their HTML, update selectors in `src/scraper/const.js`:

```javascript
const USERNAME_INPUT = 'input[name="username"]';
const PASSWORD_INPUT = 'input[name="password"]';
const BTN_LOGIN = 'button[type="submit"]';
```

---

## 🐛 Troubleshooting

### "Chrome not found" Error

**Solution:** Update Chrome path in `src/scraper/utils.js`

### "Login failed" Error

**Solutions:**
1. Check credentials in `src/scraper/const.js`
2. Try logging in manually first in Chrome
3. Instagram may require 2FA - disable temporarily or use app-specific password

### Meta Mobile Login Page

The scraper automatically detects and retries if the Meta mobile login page appears.

### Session Not Persisting

**Solution:** Check that `ports/cookies/` directory exists and has write permissions

---

## 📊 Architecture

### Electron Process Model

```
┌─────────────────────────────────────┐
│   Main Process (main.js)            │
│   - Node.js backend                 │
│   - Puppeteer scraping              │
│   - File system operations          │
└─────────────────────────────────────┘
            ↕ IPC Communication
┌─────────────────────────────────────┐
│   Renderer Process (renderer.js)    │
│   - User Interface (HTML/CSS)       │
│   - Real-time updates               │
│   - User interactions               │
└─────────────────────────────────────┘
```

### Why Puppeteer + Electron?

- **Electron** provides the desktop UI framework
- **Puppeteer** handles browser automation for scraping
- They are **complementary**, not replacements
- Electron's Chromium is for UI, Puppeteer controls external Chrome for scraping

---

## ⚠️ Important Notes

1. **Rate Limiting:** Instagram may block accounts that scrape too aggressively
2. **Terms of Service:** Review Instagram's ToS before using
3. **Credentials Security:** Never commit credentials to version control
4. **Respect Privacy:** Only scrape public information
5. **Legal Compliance:** Ensure compliance with local laws

---

## 🔒 Security Best Practices

1. **Credentials are stored in `.env` file:**
   - All sensitive credentials are now loaded from environment variables
   - The `.env` file is automatically excluded from Git via `.gitignore`
   - Never hardcode credentials in source code

2. **Protected directories in `.gitignore`:**
   ```
   .env                    # Credentials
   .env.*                  # Environment variants
   settings/accounts.txt   # Legacy credentials file
   ports/cookies/          # Instagram session cookies
   ports/output/           # Scraping results
   ports/input/            # Input CSV files
   ```

3. **Enable 2FA with app passwords** for better account security

4. **Share `.env.example`** with your team, but never share `.env`

---

## 📝 License

MIT License - Feel free to use and modify

---

## 👨‍💻 Author

**Guedes, Hugo**

For questions or issues, please open an issue on the repository.

---

## 🎯 Future Enhancements

- [ ] Headless mode option
- [ ] Export to CSV format
- [ ] Scheduled scraping
- [ ] Multiple account support
- [ ] Advanced filtering options
- [ ] Dashboard with analytics
- [ ] Proxy support

---

**Happy Scraping! 🚀**
