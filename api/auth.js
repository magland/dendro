import axios from "axios";

export default async (req, res) => {
  const code = req.query.code;
  // eslint-disable-next-line no-undef
  const clientId = process.env.VITE_GITHUB_CLIENT_ID;
  // eslint-disable-next-line no-undef
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  const tokenResponse = await axios.post(
    `https://github.com/login/oauth/access_token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    },
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const accessToken = tokenResponse.data.access_token;
  // Here, you can use the access token to perform actions on behalf of the user.
  // For example, writing to a repository specified by the user.

  res.redirect(
    `https://pairio.vercel.app/set_access_token?access_token=${accessToken}`,
  );
};
