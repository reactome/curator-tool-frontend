import { Component } from '@angular/core';
import { MatLabel } from '@angular/material/form-field';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from "@langchain/core/prompts";

@Component({
  selector: 'app-text-curation',
  standalone: true,
  imports: [MatLabel],
  templateUrl: './text-curation.component.html',
  styleUrl: './text-curation.component.scss'
})
export class TextCurationComponent {

  // Test code: Need to remove it
  chatModel = new ChatOpenAI(
    {
      openAIApiKey: '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',
    }
  )

  prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a world class biologist."],
    ["user", "{input}"],
  ]);

  async execute(command: string) {
    console.debug('Execute: ', command);
    const chain = this.prompt.pipe(this.chatModel);
    let answer = await chain.invoke({
      input: 'Tell me something about gene TANC1',
    });
    console.debug('Answer: ', answer);
  }

}
