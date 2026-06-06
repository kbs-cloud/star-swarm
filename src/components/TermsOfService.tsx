import React from 'react';

interface TermsOfServiceProps {
  onBack: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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
          TERMS OF SERVICE
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

          <Section title="1. ACCEPTANCE OF TERMS">
            By accessing or playing Star-Swarm ("the Game"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Game. Star-Swarm is an open-source project licensed under the MIT License.
          </Section>

          <Section title="2. DESCRIPTION OF SERVICE">
            Star-Swarm is a turn-based, grid multiplayer space strategy game. The Game is provided as-is, free of charge, and may be modified or discontinued at any time without prior notice.
          </Section>

          <Section title="3. USER ACCOUNTS">
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li>You may create an account using an email/password or via Google OAuth.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must provide accurate information when creating an account.</li>
              <li>Sharing account credentials is done at your own risk.</li>
            </ul>
          </Section>

          <Section title="4. ACCEPTABLE USE">
            You agree not to:
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li>Use the Game for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to the Game's servers or other users' accounts.</li>
              <li>Interfere with or disrupt the Game's infrastructure.</li>
              <li>Use automated scripts, bots, or exploits to gain unfair advantages.</li>
              <li>Harass, abuse, or threaten other players.</li>
            </ul>
          </Section>

          <Section title="5. INTELLECTUAL PROPERTY">
            Star-Swarm's source code is released under the MIT License. You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions of the MIT License. Original game assets and branding remain the property of the Star-Swarm contributors.
          </Section>

          <Section title="6. USER-GENERATED CONTENT">
            Any custom game rules, game configurations, or content you create within the Game remain yours. By sharing them through the Game's features, you grant other players the ability to use and modify them within the Game.
          </Section>

          <Section title="7. DISCLAIMER OF WARRANTIES">
            THE GAME IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE DEVELOPERS DO NOT WARRANT THAT THE GAME WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
          </Section>

          <Section title="8. LIMITATION OF LIABILITY">
            IN NO EVENT SHALL THE STAR-SWARM CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE GAME, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY.
          </Section>

          <Section title="9. MODIFICATIONS TO TERMS">
            We reserve the right to modify these Terms at any time. Continued use of the Game after changes constitutes acceptance of the new Terms. Material changes will be communicated through the Game or project repository.
          </Section>

          <Section title="10. GOVERNING LAW">
            These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through good-faith negotiation or, if necessary, binding arbitration.
          </Section>

          <Section title="11. CONTACT">
            For questions about these Terms, please open an issue on our{' '}
            <a
              href="https://github.com/kbs-cloud/star-swarm"
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
