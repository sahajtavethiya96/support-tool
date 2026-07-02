import { createElement } from "react";
import { Button, Hr, Link, Section, Text } from "react-email";
import { PRODUCT_NAME } from "@/config/platform";
import { EmailLayout, emailStyles } from "@/lib/email/components/layout";
import { renderEmailTemplate } from "@/lib/email/renderer";

const brand = "#384959";

function MyTicketsListEmail({
  listUrl,
  ticketCount,
  productName,
}: {
  listUrl: string;
  ticketCount: number;
  productName: string;
}) {
  return (
    <EmailLayout
      preview={`View your ${ticketCount} support ticket${ticketCount === 1 ? "" : "s"}`}
      productName={productName}
    >
      <Text style={emailStyles.heading}>Your support tickets</Text>
      <Text style={emailStyles.paragraph}>
        Here's a secure link to view all {ticketCount} of your ticket
        {ticketCount === 1 ? "" : "s"} with {productName}.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button
          href={listUrl}
          style={{ ...emailStyles.button, backgroundColor: brand }}
        >
          View My Tickets
        </Button>
      </Section>
      <Hr style={{ borderColor: "#BDDDFC", margin: "24px 0" }} />
      <Text style={emailStyles.muted}>This link expires in 7 days.</Text>
      <Text style={emailStyles.fallbackLink}>
        If the button does not work, paste this link into your browser:{" "}
        <Link href={listUrl} style={emailStyles.link}>
          {listUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

export async function myTicketsListTemplate(props: {
  listUrl: string;
  ticketCount: number;
}) {
  const productName = PRODUCT_NAME;
  const html = await renderEmailTemplate(
    createElement(MyTicketsListEmail, { ...props, productName })
  );

  const text = `Your support tickets

Here's a secure link to view all ${props.ticketCount} of your ticket${props.ticketCount === 1 ? "" : "s"} with ${productName}.

View my tickets: ${props.listUrl}

This link expires in 7 days.

— ${productName}`;

  return { html, text };
}
