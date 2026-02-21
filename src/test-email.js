/**
 * 邮件配置测试脚本
 */

import { sendTestEmail } from './email.js';

console.log('测试邮件发送中...');
sendTestEmail()
  .then(() => {
    console.log('测试完成！');
    process.exit(0);
  })
  .catch(err => {
    console.error('测试失败:', err.message);
    process.exit(1);
  });
