import React from 'react';
import {
  cleanup,
  render,
  waitFor,
  fireEvent,
  findAllByPlaceholderText,
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

jest.mock('axios');

let chatClient, channel;

// mock i18n
const t = (t) => t;

// MessageInput components rely on ChannelContext.
// ChannelContext is created by Channel component,
// Which relies on ChatContext, created by Chat component.
const renderComponent = (props = {}) =>
  render(
    <Chat client={chatClient}>
      <Channel channel={channel}>
        <MessageInput {...props} t={t} />
      </Channel>
    </Chat>,
  );

describe('MessageInputLarge', () => {
  const inputPlaceholder = 'Type your message';
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

  it('Should shift focus to the textarea if the `focus` prop is true', async () => {
    const { getByPlaceholderText } = renderComponent({
      focus: true,
    });
    await waitFor(() => {
      expect(getByPlaceholderText(inputPlaceholder)).toBe(
        document.activeElement,
      );
    });
  });

  it('Should open the emoji picker after clicking the icon, and allow adding emojis to the message', async () => {
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

  // TODO: close emoji picker

  describe('Attachments', () => {
    const filename = 'some.txt';
    const fileUploadUrl = 'http://www.getstream.io'; // real url, because ImagePreview will try to load the image

    const mockUploadApi = () =>
      jest.fn().mockResolvedValue(
        Promise.resolve({
          file: fileUploadUrl,
        }),
      );

    function pasteFile(file, formElement) {
      const clipboardEvent = new Event('paste', {
        bubbles: true,
      });
      // set `clipboardData`. Mock DataTransfer object
      clipboardEvent.clipboardData = {
        items: [
          {
            kind: 'file',
            getAsFile: () => file,
          },
        ],
      };

      formElement.dispatchEvent(clipboardEvent);
    }

    function dropFile(file, formElement) {
      fireEvent.drop(formElement, {
        dataTransfer: {
          files: [file],
        },
      });
    }

    it('Should upload, display and link to a file when it is pasted into the input', async () => {
      const { findByPlaceholderText, findByText } = renderComponent({
        doFileUploadRequest: mockUploadApi(),
      });

      const file = new File(['content'], filename, { type: 'text/plain' });

      pasteFile(file, await findByPlaceholderText(inputPlaceholder));

      const filenameText = await findByText(filename);

      expect(filenameText).toBeInTheDocument();
      expect(filenameText.closest('a')).toHaveAttribute('href', fileUploadUrl);
    });

    it('Should upload an image when it is pasted into the input', async () => {
      const doImageUploadRequest = mockUploadApi();
      const { findByPlaceholderText } = renderComponent({
        doImageUploadRequest,
      });

      const file = new File(['content'], filename, { type: 'image/png' });
      pasteFile(file, await findByPlaceholderText(inputPlaceholder));

      await waitFor(() => expect(doImageUploadRequest).toHaveBeenCalled());
    });

    it('Should upload an image when it is dropped on the dropzone', async () => {
      const doImageUploadRequest = mockUploadApi();
      const { findByPlaceholderText } = renderComponent({
        doImageUploadRequest,
      });
      // drop on the form input. Technically could be dropped just outside of it as well, but the input should always work.
      const formElement = await findByPlaceholderText(inputPlaceholder);
      dropFile(
        new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' }),
        formElement,
      );

      await waitFor(() => expect(doImageUploadRequest).toHaveBeenCalled());
    });

    it('Should upload, display and link to a file when it is dropped on the dropzone', async () => {
      const filename = 'some.txt';
      const { findByPlaceholderText, findByText } = renderComponent({
        doFileUploadRequest: mockUploadApi(),
      });
      // drop on the form input. Technically could be dropped just outside of it as well, but the input should always work.
      const formElement = await findByPlaceholderText(inputPlaceholder);
      dropFile(
        new File(['content'], filename, { type: 'text/plain' }),
        formElement,
      );

      const filenameText = await findByText(filename);

      expect(filenameText).toBeInTheDocument();
      expect(filenameText.closest('a')).toHaveAttribute('href', fileUploadUrl);
    });

    // TODO: clicking the file upload button
    // TODO: Failed image/file uploads
    // TODO: Remove image/file
  });

  describe('Submitting', () => {
    function setMessage(message, input) {
      fireEvent.change(input, {
        target: {
          value: message,
        },
      });
    }

    it('Should submit the input value when clicking the submit button', async () => {
      const submitMock = jest.fn().mockResolvedValue(Promise.resolve());
      const { findByTitle, findByPlaceholderText } = renderComponent({
        sendMessage: submitMock,
      });
      const submitButton = await findByTitle('Send');

      const messageText = 'Some text';
      setMessage(messageText, await findByPlaceholderText(inputPlaceholder));
      fireEvent.click(submitButton);

      expect(submitMock).toHaveBeenCalled();
      expect(
        submitMock.mock.calls[submitMock.mock.calls.length - 1][0].text,
      ).toEqual(messageText);
    });

    it('Should use overrideSubmitHandler if specified', async () => {
      const submitMock = jest.fn().mockResolvedValue(Promise.resolve());
      const { findByTitle, findByPlaceholderText } = renderComponent({
        overrideSubmitHandler: submitMock,
      });
      const submitButton = await findByTitle('Send');

      setMessage('something', await findByPlaceholderText(inputPlaceholder));
      fireEvent.click(submitButton);

      expect(submitMock).toHaveBeenCalled();
    });

    it('Should not do anything if the message is empty', async () => {
      const submitMock = jest.fn().mockResolvedValue(Promise.resolve());
      const { findByTitle } = renderComponent({
        sendMessage: submitMock,
      });
      const submitButton = await findByTitle('Send');

      fireEvent.click(submitButton);

      expect(submitMock).not.toHaveBeenCalled();
    });

    // TODO: Submitting with images?
    // TODO: Submitting with files?
  });

  describe('Editing', () => {
    it('Should edit a message if it is passed through the message prop', async () => {
      const submitMock = jest.fn().mockResolvedValue(Promise.resolve());

      const { findByTitle } = renderComponent({
        editMessage: submitMock,
        clearEditingState: () => {},
        message: generateMessage({
          mentioned_users: [],
        }),
      });
      const submitButton = await findByTitle('Send');
      fireEvent.click(submitButton);

      expect(submitMock).toHaveBeenCalled();
    });

    it('Should take file attachments from the Message object in props and pass them down to the Input', () => {
      const file = {
        type: 'file',
        asset_url: 'somewhere.txt',
        mime_type: 'text/plain',
        title: 'title',
        file_size: 1000,
      };
      const image = {
        type: 'image',
        image_url: 'somewhere.png',
        fallback: 'fallback.png',
      };

      const attachments = [file, image];

      const MessageChecker = ({ fileUploads, imageUploads }) => {
        expect(Object.keys(fileUploads).length).toEqual(1);
        expect(Object.keys(imageUploads).length).toEqual(1);
        const fileUpload = Object.values(fileUploads)[0];
        const imageUpload = Object.values(imageUploads)[0];

        expect(fileUpload.url).toEqual(file.asset_url);
        expect(imageUpload.url).toEqual(image.image_url);
        return null;
      };

      renderComponent({
        Input: MessageChecker,
        message: generateMessage({
          attachments,
          mentioned_users: [],
        }),
      });
    });
  });

  // TODO: pasting plaintext should not be prevented
  // TODO: mentioned users
});
