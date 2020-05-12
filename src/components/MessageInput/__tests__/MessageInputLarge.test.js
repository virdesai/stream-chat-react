import React from 'react';
import {
  cleanup,
  render,
  waitFor,
  fireEvent,
  findByText,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import MessageInput from '../MessageInput';
import MessageInputLarge from '../MessageInputLarge';
import { Chat } from '../../Chat';
import { Channel } from '../../Channel';
import {
  generateChannel,
  generateMember,
  generateUser,
  generateMessage,
  useMockedApis,
  getOrCreateChannelApi,
  getTestClientWithUser,
} from '../../../mock-builders';

import fetch from 'cross-fetch';

jest.mock('axios');
jest.mock('cross-fetch');

let chatClient, channel;

// mock i18n
const t = (t) => t;

const renderComponent = (props = {}) =>
  render(
    <Chat client={chatClient}>
      <Channel channel={channel}>
        <MessageInput {...props} t={t} Input={MessageInputLarge} />
      </Channel>
    </Chat>,
  );

describe('MessageInputLarge', () => {
  // First, set up a client and channel, so we can properly set up the context etc.
  beforeAll(async () => {
    const user1 = generateUser();
    const message1 = generateMessage({ user: user1 });
    const mockedChannel = generateChannel({
      messages: [message1],
      members: [generateMember({ user: user1 })],
    });
    useMockedApis(axios, [getOrCreateChannelApi(mockedChannel)]);
    chatClient = await getTestClientWithUser({ id: user1.id });
    channel = chatClient.channel('messaging', mockedChannel.id);
  });

  afterEach(cleanup);

  it('should shift focus to the textarea if the `focus` prop is true', async () => {
    const { getByPlaceholderText } = renderComponent({
      focus: true,
    });
    await waitFor(() => {
      expect(getByPlaceholderText('Type your message')).toBe(
        document.activeElement,
      );
    });
  });

  it('should open the emoji picker after clicking the icon, and allow adding emojis to the message', async () => {
    const { findByTitle, getByText, getByDisplayValue } = renderComponent();

    const emojiIcon = await findByTitle('Open emoji picker');
    fireEvent.click(emojiIcon);

    expect(getByText('Pick your emoji…')).toBeInTheDocument();

    const emoji = '💯';
    const emojiButton = getByText(emoji);
    expect(emojiButton).toBeInTheDocument();

    fireEvent.click(emojiButton);

    // expect input to have emoji as value
    expect(getByDisplayValue(emoji)).toBeInTheDocument();
  });

  describe('Uploading files', () => {
    it('Should upload, display and link to a file when it is pasted into the input', async () => {
      const filename = 'some.txt';

      const { findByText, findByPlaceholderText } = renderComponent();
      const formElement = await findByPlaceholderText('Type your message');

      const clipboardEvent = new Event('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
      });

      const file = new File(['content'], filename, { type: 'text/plain' });
      file.on = () => {};
      file.pause = () => {};
      file.on = () => {};
      // set `clipboardData`. Mock DataTransfer object
      clipboardEvent.clipboardData = {
        items: [
          {
            kind: 'file',
            getAsFile: () => file,
          },
        ],
      };

      const fileUploadUrl = 'A server far far away';

      // client sends send file request using cross-fetch, so we need to mock it
      fetch.mockResolvedValue({
        status: 200,
        json: () => ({
          file: fileUploadUrl,
        }),
      });

      // dispatch event to trigger event handlers
      formElement.dispatchEvent(clipboardEvent);

      const filenameText = await findByText(filename);

      expect(filenameText).toBeInTheDocument();
      expect(filenameText.closest('a')).toHaveAttribute('href', fileUploadUrl);
    });
  });
});
