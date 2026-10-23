import { Body, Button, Column, Container, Head, Hr, Html, Link, Preview, Row, Section, Text } from "react-email";

// Email clients can't read the CSS variables in globals.css, so the theme is copied here as hex values.
const colors = {
  page: "#f5f7fa",
  card: "#ffffff",
  text: "#14213d",
  muted: "#536176",
  border: "#dde3ec",
  primary: "#0052bc",
  navy: "#002e6e",
  flag: "#c8102e",
} as const;

export interface VolunteerInviteProps {
  roleName: string;
  /** The one-time sign-in link to /auth/confirm. */
  link: string;
  /** The /login page, for when the link has expired. */
  loginUrl: string;
}

const font = "'IBM Plex Sans', Arial, Helvetica, sans-serif";

/** The email a Volunteer Invitation sends. Volunteer screens are English-only, so this is too. */
export default function VolunteerInvite({ roleName, link, loginUrl }: VolunteerInviteProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You’re invited to volunteer on Sumbong · BetterCabanatuan</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
          <Row>
            <Column style={{ backgroundColor: colors.primary, height: 4, borderTopLeftRadius: 8 }} />
            <Column style={{ backgroundColor: colors.flag, height: 4, borderTopRightRadius: 8 }} />
          </Row>

          <Section style={{ padding: "20px 24px 0" }}>
            <Text style={{ margin: 0, color: colors.navy, fontSize: 16, fontWeight: 700 }}>Sumbong · BetterCabanatuan</Text>
          </Section>

          <Section style={{ padding: "8px 24px 0" }}>
            <Text style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "24px", color: colors.text }}>
              You’re invited to volunteer as <strong>{roleName}</strong>. Sign in with this link to confirm your email
              address; your access starts as soon as you do.
            </Text>
          </Section>

          <Section style={{ padding: "20px 24px 0" }}>
            <Button
              href={link}
              style={{
                backgroundColor: colors.primary,
                color: "#ffffff",
                fontSize: 16,
                fontWeight: 600,
                padding: "12px 20px",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Accept and sign in
            </Button>
            <Text style={{ margin: "16px 0 0", fontSize: 13, lineHeight: "20px", color: colors.muted }}>
              If the button doesn’t work, open this link:{" "}
              <Link href={link} style={{ color: colors.primary, wordBreak: "break-all" }}>
                {link}
              </Link>
            </Text>
          </Section>

          <Section style={{ padding: "0 24px 20px" }}>
            <Hr style={{ borderColor: colors.border, margin: "20px 0 16px" }} />
            <Text style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: colors.muted }}>
              The link works once and expires after an hour. After that, sign in at{" "}
              <Link href={loginUrl} style={{ color: colors.primary }}>
                {loginUrl}
              </Link>{" "}
              with this address and the invitation still applies. If you weren’t expecting this, ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

VolunteerInvite.PreviewProps = {
  roleName: "Volunteer",
  link: "https://sumbong.bettercabanatuan.org/auth/confirm?token_hash=preview&type=invite&next=%2Fv",
  loginUrl: "https://sumbong.bettercabanatuan.org/login",
} satisfies VolunteerInviteProps;
