/* eslint-disable react/jsx-curly-brace-presence */
/* eslint-disable no-console */
import React from 'react';

export const App = ({
  name = '默认名称',
  flag,
}: {
  name: string;
  flag: boolean;
}) => {
  const gender = '男';
  const nested1 = `${`  sffds你好${name}哈哈${
    gender ? '好的' : '不好'
  }为什么`}北京大学`;
  const nested2 = `${gender === '男' ? '真是男的' : `你好${name}哈哈`}北京大学`;
  const school = `北京${name}大学`;
  const school1 = `${name}北京大学`;

  const school2 = `北京大学${name}真不错aaaa${name}哈哈${
    flag ? `套娃1${school}套娃2` : '套娃3'
  }`;
  const obj = {
    title: '租户不存在',
    content: '请重新登录，或联系系统管理员创建至少一个租户',
    okText: '知道了',
  };

  const flag2 = true;
  console.log(gender, school, school1, school2, obj, nested1, nested2);
  return (
    <div
      data-alias="别名"
      data-alias2="别名2"
      data-name={flag2 ? '你好' : name}
      data-name2={flag2 ? '你好' : `意义咋样 ${name} : sffdsfd`}
      placeholder={'请输入'}
      data-v1={`你好${name}哈哈${gender}为什么`}
      data-v2={'请输入'}
    >
      html中纯文本
      {flag2 ? (
        <div>{'fdsfdf'}</div>
      ) : (
        <div>{flag2 ? '你好' : `哈哈${name}你好`}</div>
      )}
      然后分割
      {name}然后分割
    </div>
  );
};
