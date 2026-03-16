export const getWechatAccessToken = (appid: string, secret: string): Promise<string> =>
  fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`,
  )
    .then((res) => res.json() as Promise<{ access_token: string }>)
    .then(({ access_token }) => access_token);
