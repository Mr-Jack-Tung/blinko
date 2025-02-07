import { helper } from '@/lib/helper';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/trpc';
import { LinkInfo } from '@/server/types';
import { Card, Image } from '@nextui-org/react';
import { RootStore } from '@/store';
import { StorageState } from '@/store/standard/StorageState';
import { Icon } from '@iconify/react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

const highlightTags = (text) => {
  if (!text) return text
  try {
    const parts = text?.split(" ");
    return parts.map((part, index) => {
      if (part.match(helper.regex.isContainHashTag)) {
        return (
          <span key={index} className='select-none blinko-tag px-11 font-bold cursor-pointer hover:opacity-80 transition-all' >
            {part + " "}
          </span>
        );
      } else {
        return part + " ";
      }
    });
  } catch (e) {
    return text
  }
};

const Code = ({ className, children, ...props }) => {
  const { theme } = useTheme()
  const match = /language-(\w+)/.exec(className || '');
  return match ? (
    <SyntaxHighlighter
      {...props}
      PreTag="div"
      children={String(children).replace(/\n$/, '')}
      language={match[1]}
      style={theme == 'light' ? oneLight : oneDark}
    />
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const LinkPreview = ({ href }) => {
  const store = RootStore.Local(() => ({
    previewData: new StorageState<LinkInfo | null>({ key: href, default: null })
  }))

  try {
    if (typeof href == 'object') {
      return <ImageWrapper src={href?.props?.src} width={href?.props?.width} height={href?.props?.height} />
    }
  } catch (error) {
    console.log(error)
    return href
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!store.previewData.value) {
          const info = await api.public.linkPreview.query({ url: href })
          store.previewData.setValue(info)
        }
      } catch (error) {
        console.error('Error fetching preview data:', error);
      }
    };

    fetchData();
  }, [href]);

  return (
    <>
      <a href={href} target="_blank" rel="noopener noreferrer">{href}</a>
      {store.previewData.value && <Card className='p-2 my-1 bg-sencondbackground rounded-xl select-none ' radius='none' shadow='none'>
        <div className='flex items-center gap-2 w-full'>
          <div className='font-bold truncate text-sm'>{store.previewData.value?.title}</div>
          {store.previewData.value?.favicon && <Image fallbackSrc="/fallback.png" className='flex-1 rounded-full ml-auto min-w-[16px]' src={store.previewData.value.favicon} width={16} height={16}></Image>}
        </div>
        <div className='text-desc truncate text-xs'>{store.previewData.value?.description}</div>
      </Card>}
    </>
  );
};

const ImageWrapper = ({ src, width, height }) => {
  const props = { width, height }
  return (
    <PhotoProvider>
      <PhotoView src={src}>
        <Image src={src} {...props} />
      </PhotoView>
    </PhotoProvider>
  );
};



export const MarkdownRender = observer(({ content = '', onChange }: { content?: string, onChange?: (newContent: string) => void }) => {
  const { theme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef(null);
  const { t } = useTranslation()
  useEffect(() => {
    if (contentRef.current) {
      //@ts-ignore
      const isContentOverflowing = contentRef.current.scrollHeight > contentRef.current.clientHeight;
      //@ts-ignore
      const isSingleLine = contentRef.current.clientHeight === parseFloat(getComputedStyle(contentRef.current).lineHeight);
      setIsOverflowing(isContentOverflowing && !isSingleLine);
    }
  }, []);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`markdown-body`}>
      <div ref={contentRef} data-markdown-theme={theme} className={`markdown-body content ${isExpanded ? "expanded" : "collapsed"}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]} //xss
          components={{
            p: ({ node, children }) => <p>{highlightTags(children)}</p>,
            code: Code,
            a: ({ node, children }) => <LinkPreview href={children} />,
            li: ({ node, children }) => {
              try {
                if (children?.[0]?.type == 'input') {
                  let text = ''
                  let renderItem: React.ReactElement[] = []
                  if (Array.isArray(children)) {
                    new Array(children.length).fill(0).map((i, index) => {
                      if (index == 0) return
                      const item = children[index]
                      if (item?.$$typeof === Symbol.for('react.element')) {
                        text += item?.props?.children ?? ''
                        renderItem.push(item as React.ReactElement)
                      }
                      if (typeof item == 'string') {
                        text += item
                        renderItem.push(<span key={index}>{item}</span>)
                      }
                    })
                  }
                  if (children?.[0]?.props.checked) {
                    return <div className='!ml-[-18px] flex items-center gap-1 cursor-pointer hover:opacity-80'
                      onClick={() => {
                        onChange?.(content!.replace(`* [x]${text}`, `* [ ]${text}`).replace(`- [x]${text}`, `- [ ]${text}`))
                      }}>
                      <div className='w-[20px] h-[20px]'>
                        <Icon className='text-[#EAB308]' icon="lets-icons:check-fill" width="20" height="20" />
                      </div>
                      <div className='line-through text-desc'>{renderItem}</div>
                    </div>
                  }
                  return <div className='!ml-[-18px] flex items-center gap-1 cursor-pointer hover:opacity-80'
                    onClick={() => {
                      console.log(`* [ ]${text}`)
                      onChange?.(content!.replace(`* [ ]${text}`, `* [x] ${text}`).replace(`- [ ]${text}`, `- [x]${text}`))
                    }}>
                    <div className='w-[20px] h-[20px]'>
                      <Icon className='text-[#EAB308]' icon="ci:radio-unchecked" width="20" height="20" />
                    </div>
                    <div>{renderItem}</div>
                  </div>
                }
                return <li>{children}</li>
              } catch (error) {
                return <li>{children}</li>
              }
            },
            img: ImageWrapper
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {isOverflowing && content && (
        <div className='mt-2 cursor-pointer font-bold select-none hover:opacity-70 transition-all  tex-sm' onClick={toggleExpand}>{isExpanded ? t('show-less') : t('show-more')}</div>
      )}
    </div>
  );
});


export const StreamingCodeBlock = observer(({ markdown }: any) => {
  return (
    <ReactMarkdown components={{ code: Code }}>
      {markdown}
    </ReactMarkdown>
  );
});