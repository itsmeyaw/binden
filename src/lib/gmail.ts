import "server-only";

import type { Actor } from "@/lib/directory";
import { googleSend } from "@/lib/workspace";

const send = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

// Sent as the acting administrator. Header values are rejected if they carry a line break,
// so a caller cannot inject extra headers.
export async function sendMailAsActor(
  actor: Actor,
  { to, subject, text }: { to: string; subject: string; text: string },
) {
  // ponytail: development simulation, like the Directory writes; nothing is sent.
  if (process.env.GOOGLE_SIMULATION === "true") return;
  if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) throw new Error("Mail header rejected");
  // ponytail: one encoded word for the subject; a subject over ~45 bytes needs splitting (RFC 2047).
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const body =
    Buffer.from(text, "utf8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
  await googleSend(send, actor.accessToken, "POST", {
    raw: Buffer.from(message, "utf8").toString("base64url"),
  });
}
