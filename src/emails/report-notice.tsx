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

const statusColors = {
  pending_review: { background: "#eef0f3", text: "#4a5363" },
  published: { background: "#fff4e5", text: "#9a4a00" },
  forwarded: { background: "#e8f0fc", text: "#0046a0" },
  resolved: { background: "#e7f6ee", text: "#0b6b3a" },
  reopened: { background: "#f1ecfb", text: "#5b2ea6" },
  rejected: { background: "#fdecee", text: "#a50e26" },
} as const;

export type NoticeStatus = keyof typeof statusColors;

/** Every string arrives already translated; notify.ts picks the Follower's language. */
export interface ReportNoticeProps {
  locale: "fil" | "en";
  /** Inbox preview line; the subject reads well here. */
  preview: string;
  code: string;
  status: NoticeStatus;
  statusLabel: string;
  body: string;
  cta: string;
  link: string;
  linkFallback: string;
  footer: string;
}

const font = "'IBM Plex Sans', Arial, Helvetica, sans-serif";

/** The email a Follower gets whenever their Report changes status. */
export default function ReportNotice({
  locale,
  preview,
  code,
  status,
  statusLabel,
  body,
  cta,
  link,
  linkFallback,
  footer,
}: ReportNoticeProps) {
  const tone = statusColors[status];

  return (
    <Html lang={locale === "en" ? "en" : "fil"}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
          <Row>
            <Column style={{ backgroundColor: colors.primary, height: 4, borderTopLeftRadius: 8 }} />
            <Column style={{ backgroundColor: colors.flag, height: 4, borderTopRightRadius: 8 }} />
          </Row>

          <Section style={{ padding: "20px 24px 0" }}>
            <Text style={{ margin: 0, color: colors.navy, fontSize: 16, fontWeight: 700 }}>Sumbong · BetterCabanatuan</Text>
          </Section>

          <Section style={{ padding: "16px 24px 0" }}>
            <Text style={{ margin: 0, fontSize: 14, color: colors.muted }}>
              <span style={{ fontWeight: 600, color: colors.text }}>{code}</span>
              {"  "}
              <span
                style={{
                  display: "inline-block",
                  marginLeft: 8,
                  padding: "2px 10px",
                  borderRadius: 999,
                  backgroundColor: tone.background,
                  color: tone.text,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {statusLabel}
              </span>
            </Text>
          </Section>

          <Section style={{ padding: "8px 24px 0" }}>
            <Text style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "24px", color: colors.text }}>{body}</Text>
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
              {cta}
            </Button>
            <Text style={{ margin: "16px 0 0", fontSize: 13, lineHeight: "20px", color: colors.muted }}>
              {linkFallback}{" "}
              <Link href={link} style={{ color: colors.primary, wordBreak: "break-all" }}>
                {link}
              </Link>
            </Text>
          </Section>

          <Section style={{ padding: "0 24px 20px" }}>
            <Hr style={{ borderColor: colors.border, margin: "20px 0 16px" }} />
            <Text style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: colors.muted }}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ReportNotice.PreviewProps = {
  locale: "en",
  preview: "Your report CBN-7K2QXD was sent to City Engineer's Office",
  code: "CBN-7K2QXD",
  status: "forwarded",
  statusLabel: "Forwarded",
  body: "Volunteers sent your Roads & Potholes report CBN-7K2QXD to City Engineer's Office through its official channel. We’ll tell you when it’s fixed.",
  cta: "View your report",
  link: "https://sumbong.bettercabanatuan.org/r/CBN-7K2QXD?t=preview",
  linkFallback: "If the button doesn’t work, open this link:",
  footer:
    "You get this because you followed a report on Sumbong · BetterCabanatuan, a volunteer project. It is not an official City Government message.",
} satisfies ReportNoticeProps;
