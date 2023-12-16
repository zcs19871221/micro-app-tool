import { lang } from 'I18/test/dist/new/lang/config';
/* eslint-disable react/jsx-curly-brace-presence */
/* eslint-disable no-console */
import React from 'react';

export const App = ({
  name = lang.key1,
  flag,
}: {
  name: string;
  flag: boolean;
}) => {
  const gender = lang.key2;
  const nested1 = `${`  sffds${lang.key5}${name}${lang.key6}${
    gender ? lang.key3 : lang.key4
  }${lang.key7}`}${lang.key8}`;
  const nested2 = `${gender === lang.key2 ? lang.key9 : `${lang.key5}${name}${lang.key6}`}${lang.key8}`;
  const school = `${lang.key10}${name}${lang.key11}`;
  const school1 = `${name}${lang.key8}`;

  const school2 = `${lang.key8}${name}${lang.key14}aaaa${name}${lang.key6}${
    flag ? `${lang.key12}1${school}${lang.key12}2` : lang.key13
  }`;
  const obj = {
    title: lang.key15,
    content: lang.key16,
    okText: lang.key17,
  };

  const flag2 = true;
  console.log(gender, school, school1, school2, obj, nested1, nested2);
  return (
    <div
      data-alias={lang.key18}
      data-alias2={lang.key19}
      data-name={flag2 ? lang.key5 : name}
      data-name2={flag2 ? lang.key5 : `${lang.key20} ${name} : sffdsfd`}
      placeholder={lang.key21}
      data-v1={`${lang.key5}${name}${lang.key6}${gender}${lang.key7}`}
      data-v2={lang.key21}
    >
      html{lang.key22}
      {flag2 ? (
        <div>{'fdsfdf'}</div>
      ) : (
        <div>{flag2 ? lang.key5 : `${lang.key6}${name}{lang.key5}lang.key5}`}</div>
      )}
      {lang.key23}
      {name}{lang.key23}
    </div>
  );
};
