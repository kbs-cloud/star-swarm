import React from 'react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div style={{
      position: 'fixed',
      background: 'rgba(5, 3, 13, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      height: '100vh',
      width: '100vw',
      top: 0,
      paddingBottom: '68px',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        width: '100%',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
        maxWidth: '800px',
        flexDirection: 'column'
      }}>
        <button
          className="btn-sci-fi"
          onClick={onBack}
          style={{ padding: '6px 16px', fontSize: '12px' }}
        >
          ← BACK
        </button>
        <h1 style={{
          fontFamily: 'Orbitron',
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '3px',
          color: 'var(--accent-cyan)',
          textShadow: '0 0 15px rgba(0, 240, 255, 0.3)'
        }}>
          PRIVACY POLICY
        </h1>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '800px',
        overflowY: 'auto',
        padding: '0 40px 60px'
      }}>
        <div className="glass-panel glass-panel-neon-cyan" style={{
          padding: '32px',
          lineHeight: '1.7',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '12px', marginBottom: '24px' }}>
            Last Updated: May 30, 2026
          </p>

          <Section title="1. OVERVIEW">
            This Privacy Policy explains how Star-Swarm ("the Game") collects, uses, and protects your information. Star-Swarm is an open-source project and this policy applies to all instances of the Game.
          </Section>

          <Section title="2. INFORMATION WE COLLECT">
            <SubSection title="Account Information">
              When you create an account, we collect:
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>Email address</li>
                <li>Display name (optional)</li>
                <li>Hashed password (for email/password accounts)</li>
                <li>Google profile information (if using Google OAuth): name and email</li>
              </ul>
            </SubSection>
            <SubSection title="Game Data">
              We store game-related data including:
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>Game states and configurations</li>
                <li>Custom game rules you create</li>
                <li>Game statistics (wins, losses, turns played)</li>
              </ul>
            </SubSection>
            <SubSection title="Technical Data">
              The Game may automatically collect:
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li>Browser type and version</li>
                <li>Session cookies for authentication</li>
                <li>CSRF tokens for security</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. HOW WE USE YOUR INFORMATION">
            Your information is used to:
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li>Authenticate your identity and maintain your session.</li>
              <li>Enable multiplayer features and game invitations.</li>
              <li>Store and retrieve your game progress.</li>
              <li>Display your name to other players in shared games.</li>
              <li>Protect against unauthorized access and abuse.</li>
            </ul>
          </Section>

          <Section title="4. DATA STORAGE & SECURITY">
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li>Game data is stored in a SQLite database on the server.</li>
              <li>Passwords are hashed using bcrypt before storage.</li>
              <li>Sessions are managed via secure HTTP-only cookies.</li>
              <li>CSRF protection is implemented to prevent cross-site request forgery.</li>
            </ul>
            While we take reasonable measures to protect your data, no method of electronic storage or transmission is 100% secure.
          </Section>

          <Section title="5. COOKIES & LOCAL STORAGE">
            The Game uses:
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li><strong>Session cookies</strong> — to maintain your login state.</li>
              <li><strong>CSRF cookies</strong> — to protect against cross-site attacks.</li>
              <li><strong>Local storage</strong> — to save preferences such as display name, sound settings, and guest game data.</li>
            </ul>
          </Section>

          <Section title="6. THIRD-PARTY SERVICES">
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li><strong>Google OAuth</strong> — If you sign in with Google, your authentication is handled by Google's OAuth 2.0 service. We receive only your email and profile name. Refer to{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
                >
                  Google's Privacy Policy
                </a> for more information.
              </li>
              <li><strong>Google Fonts</strong> — The Game loads fonts from Google Fonts, which may collect usage data per{' '}
                <a
                  href="https://developers.google.com/fonts/faq/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
                >
                  Google's font privacy policy
                </a>.
              </li>
            </ul>
          </Section>

          <Section title="7. DATA SHARING">
            We do not sell, trade, or rent your personal information. Your data may be visible to other players only in the context of shared multiplayer games (e.g., your display name and in-game actions).
          </Section>

          <Section title="8. DATA RETENTION">
            Your account and game data are retained as long as your account is active. Since this is an open-source, self-hosted project, data retention depends on the specific instance operator.
          </Section>

          <Section title="9. YOUR RIGHTS">
            You have the right to:
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li>Access your personal data stored by the Game.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Change your display name and password at any time via Settings.</li>
            </ul>
            To exercise these rights, open an issue on our GitHub repository or contact the instance operator.
          </Section>

          <Section title="10. CHILDREN'S PRIVACY">
            Star-Swarm is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information, please contact us so we can remove it.
          </Section>

          <Section title="11. CHANGES TO THIS POLICY">
            We may update this Privacy Policy from time to time. Changes will be posted in the Game or on the project repository. Continued use of the Game after updates constitutes acceptance of the revised policy.
          </Section>

          <Section title="12. CONTACT">
            For privacy-related inquiries, please open an issue on our{' '}
            <a
              href="https://github.com/malkamius/star-swarm/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
            >
              GitHub repository
            </a>.
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <h3 style={{
      fontFamily: 'Orbitron',
      fontSize: '13px',
      fontWeight: 600,
      letterSpacing: '1.5px',
      color: 'var(--accent-cyan)',
      marginBottom: '10px',
      textShadow: '0 0 8px rgba(0, 240, 255, 0.2)'
    }}>
      {title}
    </h3>
    <div>{children}</div>
  </div>
);

const SubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '12px' }}>
    <h4 style={{
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.5px',
      color: 'var(--text-primary)',
      marginBottom: '6px'
    }}>
      {title}
    </h4>
    <div>{children}</div>
  </div>
);
