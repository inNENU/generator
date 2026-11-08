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

  return `\
::: info ${escapeHtml(header || `${lName}${fName} 联系方式`)}

- 姓名: ${escapeHtml(lName)}${escapeHtml(fName)}
- 电话: [${escapeHtml(String(num))}](tel:${num})
${workNum ? `- 工作电话: ${escapeHtml(String(workNum))}\n` : ""}\
${hostNum ? `- 公司电话: ${escapeHtml(String(hostNum))}\n` : ""}\
${homeNum ? `- 家庭电话: ${escapeHtml(String(homeNum))}\n` : ""}\
${site ? `- 网站: <${escapeHtml(site)}>\n` : ""}\
${mail ? `- 邮箱: [${escapeHtml(mail)}](mailto:${mail})\n` : ""}\
${org ? `- 组织: ${escapeHtml(org)}\n` : ""}\
${title ? `- 职位: ${escapeHtml(title)}\n` : ""}\
${nick ? `- 昵称: ${escapeHtml(nick)}\n` : ""}\
${remark ? `- 备注: ${escapeHtml(remark).replaceAll("\n", "\n  ")}\n` : ""}\
${province || city || street ? `- 地址: ${escapeHtml(province)}${escapeHtml(city)}${escapeHtml(street)}\n` : ""}\
${postCode ? `- 邮编: ${escapeHtml(String(postCode))}\n` : ""}\

:::

`;
};
