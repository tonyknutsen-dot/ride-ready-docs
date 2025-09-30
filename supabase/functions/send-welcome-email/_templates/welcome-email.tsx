import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface WelcomeEmailProps {
  email: string;
}

export const WelcomeEmail = ({ email }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Ride Ready Docs - Your Document Management Solution</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Ride Ready Docs!</Heading>
        <Text style={text}>
          Thank you for signing up, {email}! We're excited to have you on board.
        </Text>
        <Text style={text}>
          Ride Ready Docs is your complete document management solution designed specifically 
          for fairground professionals. Keep all your ride documents, safety certificates, 
          and technical bulletins organized in one secure place.
        </Text>
        
        <Section style={section}>
          <Heading style={h2}>Getting Started</Heading>
          <Text style={text}>
            To make the most of your account, here are your next steps:
          </Text>
          <ul style={list}>
            <li style={listItem}>Complete your profile with company details</li>
            <li style={listItem}>Add your rides to the system</li>
            <li style={listItem}>Upload important documents and certificates</li>
            <li style={listItem}>Set up daily check templates for your rides</li>
            <li style={listItem}>Schedule inspections and maintenance</li>
          </ul>
        </Section>

        <Section style={ctaSection}>
          <Link
            href="https://310a4bd0-111d-48cb-b45f-f3b22b34bee6.lovableproject.com/dashboard"
            style={button}
          >
            Go to Dashboard
          </Link>
        </Section>

        <Text style={text}>
          If you have any questions or need assistance, please don't hesitate to reach out 
          to our support team at support@showmendocs.com
        </Text>

        <Text style={footer}>
          <Link
            href="https://310a4bd0-111d-48cb-b45f-f3b22b34bee6.lovableproject.com"
            target="_blank"
            style={link}
          >
            Ride Ready Docs
          </Link>
          <br />
          The complete document management solution for fairground professionals
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '24px 0 16px',
  padding: '0',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 40px',
};

const section = {
  padding: '24px 40px',
};

const list = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  paddingLeft: '40px',
};

const listItem = {
  marginBottom: '8px',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const link = {
  color: '#007bff',
  textDecoration: 'underline',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '48px 40px 0',
  textAlign: 'center' as const,
};
