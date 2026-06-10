import { useState } from 'react';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={() => setShowSettings(false)}>
            ← 返回
          </button>
          <h1 style={styles.title}>设置</h1>
        </div>
        <div style={styles.content}>
          <p style={styles.text}>设置页面开发中...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Ozon智能选品助手</h1>
        <button 
          style={styles.settingsButton} 
          onClick={() => setShowSettings(true)}
          title="设置"
        >
          ⚙️
        </button>
      </div>
      <div style={styles.content}>
        <p style={styles.text}>插件已加载，请打开Wildberries或Ozon页面</p>
        <div style={styles.statusBox}>
          <span style={styles.statusDot}>●</span>
          <span style={styles.statusText}>就绪</span>
        </div>
      </div>
      <div style={styles.footer}>
        <span style={styles.version}>v1.0.0</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    minHeight: 200,
    backgroundColor: '#f6f8fb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#2f6bff',
    color: 'white',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  settingsButton: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
  },
  content: {
    padding: 16,
  },
  text: {
    fontSize: 14,
    color: '#637089',
    margin: '0 0 12px 0',
    lineHeight: 1.5,
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    backgroundColor: '#e6fff0',
    borderRadius: 6,
    border: '1px solid #b8e6c8',
  },
  statusDot: {
    color: '#16a37b',
    fontSize: 12,
  },
  statusText: {
    fontSize: 13,
    color: '#16a37b',
    fontWeight: 500,
  },
  footer: {
    padding: '8px 16px',
    borderTop: '1px solid #e6eaf2',
    textAlign: 'right',
  },
  version: {
    fontSize: 11,
    color: '#9ca3af',
  },
};

export default App;
