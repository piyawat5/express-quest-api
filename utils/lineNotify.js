import axios from "axios";

export async function sendLineMessage(message) {
  const accessToken = process.env.LINE_ACCESS_TOKEN_ASSISTANT;
  const groupId = process.env.LINE_GROUP_ID;

  try {
    const response = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: groupId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error sending LINE message:",
      error.response?.data || error.message
    );
    throw error;
  }
}
