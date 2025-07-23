import type { PhoneComponentOptions } from "./schema.js";
import { checkPhone } from "./schema.js";

export const getPhoneMarkdown = (
  phone: PhoneComponentOptions,
  location = "",
): string => {
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
::: info ${header || `${lName}${fName} 联系方式`}

- 姓名: ${lName}${fName}
- 电话: [${num}](tel:${num})
${workNum ? `- 工作电话: ${workNum}\n` : ""}\
${hostNum ? `- 公司电话: ${hostNum}\n` : ""}\
${homeNum ? `- 家庭电话: ${homeNum}\n` : ""}\
${site ? `- 网站: <${site}>\n` : ""}\
${mail ? `- 邮箱: [${mail}](mailto:${mail})\n` : ""}\
${org ? `- 组织: ${org}\n` : ""}\
${title ? `- 职位: ${title}\n` : ""}\
${nick ? `- 昵称: ${nick}\n` : ""}\
${remark ? `- 备注: ${remark}\n` : ""}\
${province || city || street ? `- 地址: ${province}${city}${street}\n` : ""}\
${postCode ? `- 邮编: ${postCode}\n` : ""}\

:::

`;
};
