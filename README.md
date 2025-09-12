# CodeDog - AI-Powered Supply Chain Threat Detection

A full-stack application that analyzes GitHub repositories for security threats in real-time using AI-powered analysis and Docker sandboxing.

## 🎯 Features

- **Real-time Analysis**: Stream logs and alerts as repositories are analyzed
- **Secure Sandboxing**: Run builds in isolated Docker containers
- **AI-Powered Detection**: Identify typosquatting, suspicious commits, and runtime anomalies
- **Risk Scoring**: Comprehensive 0-100 risk assessment with categorization
- **Modern UI**: Clean, responsive dashboard with dark/light theme support

## 🏗️ Architecture

```
/project-root
├── /frontend      # React.js + TailwindCSS + Socket.IO
├── /backend       # Node.js + Express + Socket.IO + Docker
├── /docker        # Sandbox container images
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd supply-chain-threat-detection
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Build Docker images**
   ```bash
   cd ../docker
   docker build -f Dockerfile.node -t threat-detector:node .
   docker build -f Dockerfile.python -t threat-detector:python .
   ```

### Development

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Open your browser**
   Navigate to `http://localhost:3000`

## 📊 Usage

1. Enter a GitHub repository URL
2. Select the project type (Node.js or Python)
3. Click "Analyze Repository"
4. Watch real-time analysis in the dashboard
5. Review the final risk assessment and alerts

## 🛡️ Security Features

- **Container Isolation**: All builds run in sandboxed Docker containers
- **Network Restrictions**: Containers have no network access during analysis
- **Resource Limits**: Memory and CPU limits prevent resource exhaustion
- **Input Validation**: All user inputs are validated and sanitized

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📝 API Documentation

### REST Endpoints

- `POST /api/analyze-repo` - Start repository analysis
- `GET /api/job/:jobId/status` - Get job status

### WebSocket Events

- `log` - Build and analysis logs
- `alert` - Security threat alerts
- `progress` - Analysis progress updates
- `done` - Final analysis summary

## 🎬 Demo Script

Perfect for hackathon presentations:

1. Enter a suspicious repository URL
2. Show real-time log streaming
3. Highlight detected threats and alerts
4. Present final risk score and summary

## 🤝 Contributing

This is a hackathon project. Feel free to fork and improve!

## 📄 License

MIT License - see LICENSE file for details