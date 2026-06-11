# TopRouter Testing Checklist
**URL:** http://localhost:20129  
**Password:** 123456

## ✅ Deployment Status
- PM2 Status: ONLINE (fork mode, 1 instance)
- Port: 20129
- Database: SQLite at /home/sirobo/.toprouter
- Auto-start: ENABLED (systemd)

## Manual Browser Testing Steps

### 1. Login Test
- [ ] Open http://localhost:20129/login
- [ ] Enter password: 123456
- [ ] Click "Sign In"
- [ ] Should redirect to /dashboard

### 2. Dashboard Test
- [ ] Dashboard loads without errors
- [ ] Navigation menu visible
- [ ] Usage statistics displayed
- [ ] Recent requests visible (if any)

### 3. Provider Management Test
- [ ] Navigate to "Providers" page
- [ ] Click "Add Provider"
- [ ] Select provider: OpenAI
- [ ] Enter API Key: sk-test-browser-123
- [ ] Enter Name: BrowserTestProvider
- [ ] Click "Save"
- [ ] Provider appears in list
- [ ] Click edit icon → update name
- [ ] Click delete icon → confirm deletion

### 4. Combo Management Test
- [ ] Navigate to "Combos" page
- [ ] Click "Add Combo"
- [ ] Enter name: test-combo-browser
- [ ] Select kind: Chat
- [ ] Add models: gpt-4o, claude-sonnet-4
- [ ] Click "Save"
- [ ] Combo appears in list
- [ ] Click edit → update models
- [ ] Click delete → confirm deletion

### 5. Settings Test
- [ ] Navigate to "Settings" page
- [ ] Change "Sticky Round Robin Limit" value
- [ ] Click "Save"
- [ ] Refresh page → setting persists

### 6. Models Test
- [ ] Navigate to "Models" page
- [ ] Model list loads
- [ ] Filter works (if available)
- [ ] Model details expandable

### 7. Usage Stats Test
- [ ] Navigate to "Usage" page
- [ ] Charts render without errors
- [ ] Stats by provider/model visible
- [ ] Period selector works (24h/7d/30d)

## API Test Results (Already Completed ✓)
```
✓ Authentication (login/logout)
✓ Provider CRUD (create/read/update/delete)
✓ Combo CRUD (create/read/update/delete)
✓ Settings management
✓ Models listing (v1 API)
✓ Usage statistics & charts
✓ Dashboard & login pages (HTTP 200)
```

## Known Issues Fixed
1. ✅ Async transaction error in better-sqlite3 adapter
2. ✅ Missing `tx` parameter in transaction callbacks
3. ✅ PM2 cluster mode race condition (switched to fork mode)
4. ✅ Port conflict with old 9router CLI process

## Files Modified
- `src/lib/db/adapters/betterSqliteAdapter.js` - Fixed async transaction support
- `src/lib/db/adapters/nodeSqliteAdapter.js` - Fixed async transaction support
- `ecosystem.config.cjs` - Changed to 1 instance fork mode

## PM2 Commands
```bash
pm2 status toprouter        # Check status
pm2 logs toprouter          # View logs
pm2 restart toprouter       # Restart app
pm2 stop toprouter          # Stop app
pm2 save                    # Save current state
```

## Health Check
```bash
curl http://localhost:20129/api/health
# Expected: {"ok":true}
```

## Notes
- All backend CRUD operations verified working
- Database transactions now support async/await properly
- PM2 configured for auto-restart on system boot
- No errors in PM2 logs during testing
