import axios from "axios";
import { StatusCodeInterpretation } from "../models/error";
import { toast } from "vue3-toastify";

// get the API token from localStorage or ask the user
function getApiToken() {
  let apiToken = localStorage.getItem("apiToken");
  if (!apiToken) {
    apiToken = prompt("Please enter your API token:");

    if (apiToken) {
      localStorage.setItem("apiToken", apiToken);
    } else {
      alert("API token is required for authorization.");
      throw new Error("API token is required");
    }
  }
  return apiToken;
}

export const apiToken = getApiToken();

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiToken}`,
  },
});

// export default axiosInstance;

// axiosInstance.interceptors.request.use(
//   (config) => {
//     if (!config.noToast) config.toastId = toast.info("載入中");

//     // Exclude specific URLs from adding the bearer token
//     const excludedStartWith = ["/template", "/healthcheck"];
//     const excludedEqual = [
//       "/stage",
//       "/site-info",
//       "/auth/login",
//       "/auth/register",
//     ];

//     const shouldExclude =
//       excludedStartWith.some((url) => config.url.startsWith(url)) ||
//       excludedEqual.includes(config.url);

//     if (!shouldExclude) {
//       const localToken = localStorage.getItem("token");
//       if (!localToken)
//         throw new Error(
//           "login is requried when requesting the url: " + config.url
//         );
//       else config.headers.Authorization = `Bearer ${localToken}`;
//     }

//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.config.toastId) toast.remove(response.config.toastId);
    return response;
  },
  (error) => {
    console.error(error);
    if (error.response && error.response.config.silenceError !== true) {
      if (error.response.config.toastId)
        toast.remove(error.response.config.toastId);
      const isSimpleMessage = error.response.data.message.indexOf("\n") === -1;
      toast.error(
        `${StatusCodeInterpretation[error.response.status]}${
          isSimpleMessage ? "：" + error.response.data.message : ""
        }
若您認為不該出錯，報修代碼: ${error.response.data.requestId}`
      );
    }
    return error;
  }
);

export default axiosInstance;
