import { lang } from 'Test/dist/lang/config';
/* eslint-disable react/jsx-curly-brace-presence */
/* eslint-disable no-console */
//@ts-ignore
import React from 'react';

interface Custom<CustomT> {}
export const App = ({
  name = lang.key0001,
  flag,
}: {
  name: string;
  flag: boolean;
}) => {
  const gender = lang.key0002;
  const nested1 = `${`  sffds${lang.key0005}${name}${lang.key0006}${
    gender ? lang.key0003 : lang.key0004
  }${lang.key0007}`}${lang.key0008}`;
  const nested2 = `${gender === lang.key0002 ? lang.key0009 : `${lang.key0005}${name}${lang.key0006}`}${lang.key0008}`;
  const school = `${lang.key0010}${name}${lang.key0011}`;
  const school1 = `${name}${lang.key0008}`;

  const school2 = `${lang.key0008}${name}${lang.key0014}aaaa${name}${lang.key0006}${
    flag ? `${lang.key0012}1${school}${lang.key0012}2` : lang.key0013
  }`;
  const obj = {
    title: lang.key0015,
    content: lang.key0016,
    okText: lang.key0017,
  };

  const flag2 = true;
  const x = `${lang.key0018}\``;
  const noVariable = ` sfdsfds${lang.key0005}dsffds${lang.key0005}`;
  console.log(gender, school, school1, school2, obj, nested1, nested2);
  return (
    <div
      data-alias={lang.key0019}
      data-alias2={lang.key0020}
      data-name={flag2 ? lang.key0005 : name}
      data-name2={flag2 ? lang.key0005 : `${lang.key0021} ${name} : sffdsfd`}
      placeholder={lang.key0022}
      data-v1={`${lang.key0005}${name}${lang.key0006}${gender}${lang.key0007}`}
      data-v2={lang.key0022}
    >
      `${}html{lang.key0023}`
      {flag2 ? (
        <div>{'fdsfdf'}</div>
      ) : (
        <div>{flag2 ? lang.key0005 : `${lang.key0006}${name}${lang.key0005}`}</div>
      )}
      {lang.key0024}
      {name}{lang.key0024}
      <div>fff{lang.key0025}zzx{lang.key0025}</div>
      <div>
        {lang.key0025}
        </div>
    </div>
  );
};
