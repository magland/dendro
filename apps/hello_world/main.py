import json
from dendro.sdk import App, ProcessorBase, BaseModel, Field, InputFile, OutputFile

app = App(
    app_name='hello_world',
    description='A simple hello world app'
)

class HelloWorld1ProcessorContext(BaseModel):
    name: str = Field(description='The name to say hello to', default='world')

class HelloWorld1Processor(ProcessorBase):
    name = 'hello_world_1'
    description = 'Prints "Hello, {name}!"'
    label = 'hello_world_1'
    image = 'magland/dendro-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: HelloWorld1ProcessorContext
    ):
        name = context.name
        print(f'Hello, {name}!')

class HelloWorld2ProcessorContext(BaseModel):
    output: OutputFile = Field(description='The output text file')
    name: str = Field(description='The name to say hello to', default='world')

class HelloWorld2Processor(ProcessorBase):
    name = 'hello_world_2'
    description = 'Outputs a text file with "Hello, {name}!" in it'
    label = 'hello_world_2'
    image = 'magland/dendro-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: HelloWorld2ProcessorContext
    ):
        name = context.name
        with open('output.txt', 'w') as f:
            f.write(f'Hello, {name}!')
        context.output.upload('output.txt')

class CountCharactersProcessorContext(BaseModel):
    input: InputFile = Field(description='The input text file')
    output: OutputFile = Field(description='The output JSON file')
    include_whitespace: bool = Field(description='Whether to include whitespace in the count', default=True)


class CountCharactersProcessor(ProcessorBase):
    name = 'count_characters'
    description = 'Counts the number of characters in a text file'
    label = 'count_characters'
    image = 'magland/dendro-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: CountCharactersProcessorContext
    ):
        include_whitespace = context.include_whitespace
        context.input.download('input.txt')
        with open('input.txt', 'r') as f:
            txt = f.read()
        if not include_whitespace:
            txt = txt.replace(' ', '').replace('\n', '').replace('\t', '').replace('\r', '')
        num_characters = len(txt)
        output = {
            'num_characters': num_characters
        }
        with open('output.json', 'w') as f:
            json.dump(output, f)

        context.output.upload('output.json')

app.add_processor(HelloWorld1Processor)
app.add_processor(HelloWorld2Processor)
app.add_processor(CountCharactersProcessor)

if __name__ == '__main__':
    app.run()
