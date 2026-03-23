import axios from 'axios';
import axiosRetry from 'axios-retry';
import { timeout } from 'src/common/timeout';

const axiosInit = axios.create({
  headers: { maxRedirects: 5 },
  timeout: timeout.oneSecond * 10,
});

axiosRetry(axiosInit, {
  retries: 5,
  retryCondition: (error) => {
    return error.response.status === 429;
  },
  retryDelay: (retryCount) => {
    return retryCount * 1000;
  },
});

export default axiosInit;
