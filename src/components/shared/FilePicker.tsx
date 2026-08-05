import { useRef, useState, type ChangeEvent } from 'react';
import { Box, Button, Flex, IconButton, Text } from '@chakra-ui/react';
import { buttonStyles, fieldStyles } from '../../theme';

interface FilePickerProps {
  accept?: string;
  disabled?: boolean;
  buttonLabel?: string;
  placeholder?: string;
  onFileChange: (file: File | null) => void | Promise<void>;
}

export function FilePicker({
  accept,
  disabled = false,
  buttonLabel = 'Browse…',
  placeholder = 'No file chosen',
  onFileChange,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    void onFileChange(file);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFileName(null);
    void onFileChange(null);
  };

  return (
    <Box
      borderWidth="1px"
      borderColor="whiteAlpha.100"
      borderRadius="lg"
      bg="rgba(0,0,0,.22)"
      overflow="hidden"
      opacity={disabled ? 0.55 : 1}
      transition="border-color .15s"
      _hover={disabled ? undefined : { borderColor: 'whiteAlpha.200' }}
    >
      <Flex align="stretch" minH="42px">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          hidden
          onChange={handleChange}
        />
        <Button
          size="sm"
          h="auto"
          minH="42px"
          px={4}
          borderRadius={0}
          borderRightWidth="1px"
          borderRightColor="whiteAlpha.100"
          disabled={disabled}
          {...buttonStyles.secondary}
          onClick={() => inputRef.current?.click()}
        >
          {buttonLabel}
        </Button>
        <Flex
          flex={1}
          align="center"
          px={3}
          gap={2}
          minW={0}
          {...fieldStyles.control}
          borderWidth={0}
          borderRadius={0}
          bg="transparent"
          boxShadow="none"
        >
          <Text
            flex={1}
            fontSize="sm"
            color={fileName ? 'gray.200' : 'gray.500'}
            truncate
            title={fileName ?? placeholder}
          >
            {fileName ?? placeholder}
          </Text>
          {fileName && !disabled && (
            <IconButton
              aria-label="Clear file"
              size="xs"
              variant="ghost"
              color="gray.500"
              minW="24px"
              h="24px"
              borderRadius="md"
              _hover={{ color: 'gray.200', bg: 'whiteAlpha.100' }}
              onClick={clear}
            >
              ×
            </IconButton>
          )}
        </Flex>
      </Flex>
    </Box>
  );
}
