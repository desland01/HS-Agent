#!/bin/bash
# Home Service Agent - Project Initialization Script

echo "🏠 Setting up Home Service Agent..."
echo "Linear Project: https://linear.app/grovestreetpainting/project/home-service-agent-f26a8017023a"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project root directory. Please cd to home-service-agent/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

# Create .env from example if not exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file from template"
        echo "⚠️  Please configure environment variables in .env"
    else
        echo "📝 Creating basic .env template..."
        cat > .env << EOF
# Home Service Agent Configuration
NODE_ENV=development
PORT=3001

# Required
ANTHROPIC_API_KEY=your_anthropic_api_key_here
REDIS_URL=redis://localhost:6379

# Optional - Facebook Integration
FB_PAGE_ACCESS_TOKEN=
FB_APP_SECRET=
FB_VERIFY_TOKEN=
FB_PAGE_ID=

# Optional - iMessage Integration
OB_IMESSAGE_ENDPOINT=
OB_IMESSAGE_API_KEY=
IMESSAGE_WEBHOOK_SECRET=

# Optional - SMS Fallback
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Optional - GoHighLevel CRM
GHL_API_KEY=
GHL_LOCATION_ID=
EOF
        echo "✅ Created basic .env template"
        echo "⚠️  Please add your API keys to .env"
    fi
else
    echo "✅ .env file already exists"
fi

# Verify TypeScript compilation
echo "🔍 Running type check..."
if npm run typecheck; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript errors found - check output above"
fi

# Check Redis connection (if running)
echo "🔍 Checking Redis connection..."
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis is running and accessible"
    else
        echo "⚠️  Redis not accessible. Start with: brew services start redis"
    fi
else
    echo "⚠️  Redis CLI not found. Install with: brew install redis"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Configure .env with your API keys"
echo "2. Start Redis if not running: brew services start redis"
echo "3. Run development server: npm run dev"
echo "4. Check Linear for implementation tasks: https://linear.app/grovestreetpainting/project/home-service-agent-f26a8017023a"
echo ""
echo "🤖 Autonomous Agent:"
echo "   cd agent && python autonomous_agent.py --project-dir ../"
echo ""
echo "✨ Setup complete! Happy coding!"