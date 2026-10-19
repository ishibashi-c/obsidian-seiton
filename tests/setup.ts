import { setYamlParser } from "../src/shared/frontmatter";
import { testParseYaml } from "./helpers/yaml";

// モジュール読み込み時に即座に注入する（describe本体の評価はbeforeAllより先に走るため）
setYamlParser(testParseYaml);
