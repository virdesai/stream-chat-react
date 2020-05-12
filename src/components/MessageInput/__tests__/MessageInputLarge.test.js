import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
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

jest.mock('axios');

let chatClient, channel;

const renderComponent = (props) => render(
  <Chat client={chatClient}>
    <Channel channel={channel}>
      <MessageInput {...props} Input={MessageInputLarge} />
    </Channel>
  </Chat>
);

describe('MessageInputLarge', () => {
  // First, set up a client and channel, so we can properly set up the context etc.
  beforeAll(async () => {
    const user1 = generateUser();
    const message1 = generateMessage({ user: user1 });
    const mockedChannel = generateChannel({
      messages: [message1],
      members: [
        generateMember({ user: user1 }),
      ],
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
      expect(getByPlaceholderText('Type your message')).toBe(document.activeElement);
    });
  });
});