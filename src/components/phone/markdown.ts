import { sanitizeUrl } from "../../helpers/url.js";
import { escapeHtml } from "../../utils.js";
import type { PhoneComponentOptions } from "./schema.js";
import { checkPhone } from "./schema.js";

// oxlint-disable-next-line complexity
export const getPhoneMarkdown = (phone: PhoneComponentOptions, location = ""): string => {
  if (phone.env && !phone.env.includes("web")) return "";

  checkPhone(phone, location);

  const {
    header = "",
    fName,
    lName = "",
    num,
    workNum,
    homeNum,
    hostNum,
    nick,
    org,
    title,
    remark,
    province = "",
    city = "",
    street = "",
    postCode,
    mail,
    site,
  } = phone;

  const telUrl = sanitizeUrl(`tel:${num}`);
  const siteUrl = sanitizeUrl(site);
  const mailUrl = mail ? sanitizeUrl(`mailto:${mail}`) : null;

  return `\
::: info ${escapeHtml(header || `${lName}${fName} 联系方式`)}

- 姓名: ${escapeHtml(lName)}${escapeHtml(fName)}
- 电话: ${telUrl ? `[${escapeHtml(String(num))}](${telUrl})` : escapeHtml(String(num))}
${workNum ? `- 工作电话: ${escapeHtml(String(workNum))}\n` : ""}\
${hostNum ? `- 公司电话: ${escapeHtml(String(hostNum))}\n` : ""}\
${homeNum ? `- 家庭电话: ${escapeHtml(String(homeNum))}\n` : ""}\
${siteUrl ? `- 网站: <${escapeHtml(siteUrl)}>\n` : ""}\
${mail ? (mailUrl ? `- 邮箱: [${escapeHtml(mail)}](${mailUrl})\n` : `- 邮箱: ${escapeHtml(mail)}\n`) : ""}\
${org ? `- 组织: ${escapeHtml(org)}\n` : ""}\
${title ? `- 职位: ${escapeHtml(title)}\n` : ""}\
${nick ? `- 昵称: ${escapeHtml(nick)}\n` : ""}\
${remark ? `- 备注: ${escapeHtml(remark).replaceAll("\n", "\n  ")}\n` : ""}\
${province || city || street ? `- 地址: ${escapeHtml(province)}${escapeHtml(city)}${escapeHtml(street)}\n` : ""}\
${postCode ? `- 邮编: ${escapeHtml(String(postCode))}\n` : ""}\

:::

`;
};
