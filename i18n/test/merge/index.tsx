/* eslint-disable no-console */
import React from 'react';

export const App = ({ name = '默认名称' }: { name: string }) => {
  const gender = '男';
  const school = `北京${name}大学`;
  const school1 = `${name}北京大学`;
  const school2 = `北京大学${name}真不错aaaa${name}`;
  const obj = {
    title: '租户不存在',
    content: '请重新登录，或联系系统管理员创建至少一个租户',
    okText: '知道了',
  };

  console.log(gender, school, school1, school2, obj);
  return <div data-alias="别名">html中纯文本{`复合文本${name}`}</div>;
};
