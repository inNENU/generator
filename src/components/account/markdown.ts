import type { AccountComponentOptions } from "./typings.js";
import { getAssetIconLink, getFileLink } from "../../utils.js";

export const getAccountMarkdown = (
  account: AccountComponentOptions,
): string => {
  // `$` alias resolve and file check
  if (account.logo) account.logo = getFileLink(account.logo);
  if (account.qqcode) account.qqcode = getFileLink(account.qqcode);
  if (account.wxcode) account.wxcode = getFileLink(account.wxcode);

  const { name, detail, desc, logo, qq, qqcode, wxid, wxcode, site, mail } =
    account;

  return `\
<div class="innenu-account">
  <img class="innenu-account-background" src="${logo}" alt="${name}" loading="lazy" no-view />
  <div class="innenu-account-content">
    <img class="innenu-account-logo" src="${logo}" alt="${name}" loading="lazy" no-view />
    <div class="innenu-account-name">${name}</div>
${
  detail
    ? `\
    <div class="innenu-account-detail">${detail}</div>
`
    : ""
}\
${
  desc
    ? `\
    <div class="innenu-account-description">${desc}</div>
`
    : ""
}\
  </div>
  <div class="innenu-account-action-list">
${
  (qq ?? qqcode)
    ? `\
    <button class="innenu-account-action" ${
      qq ? `aria-label="${qq}" data-balloon-pos="up" data-qq="${qq}" ` : ""
    }${qqcode ? `data-qqcode="${qqcode}"` : ""}>
      <img class="innenu-account-icon" src="${getAssetIconLink(
        "qq",
      )}" alt="" no-view />
    </button>
`
    : ""
}\
${
  (wxid ?? wxcode)
    ? `\
    <button class="innenu-account-action" ${
      wxid ? `data-wxid="${wxid}" ` : ""
    }${wxcode ? `data-wxcode="${wxcode}" ` : ""}>
      <img class="innenu-account-icon" src="${getAssetIconLink(
        "wechat",
      )}" alt="" no-view />
    </button>
`
    : ""
}\
${
  site
    ? `\
    <a class="innenu-account-action" href="${site}" target="_blank">
      <img class="innenu-account-icon" src="${getAssetIconLink(
        "web",
      )}" alt="" no-view />
    </a>
`
    : ""
}\
${
  mail
    ? `\
    <a class="innenu-account-action" href="mailto:${mail}">
      <img class="innenu-account-icon" src="${getAssetIconLink(
        "mail",
      )}" alt="" no-view />
    </a>
`
    : ""
}\
  </div>
</div>

`;
};
